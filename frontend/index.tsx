import { Millennium, IconsModule, definePlugin, callable, Field,
  TextField, Toggle, PanelSection, DropdownItem, DialogButton} from '@steambrew/client';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings, RssSourceEntry } from './services/settings';
import { Localize, GetLanguageOptions } from './services/localization';

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const get_url_data = callable<[{ url: string }], string>('get_url_data');
const print_log = callable<[{ text: string }], string>('print_log');

const TITLE_MAX_LINES = 4;

// Faintly tinted 1x1 SVG shown while the real image preloads (see preloadImage in SpawnRSS).
const IMAGE_LOADING_PLACEHOLDER =
    'data:image/svg+xml,' + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'><rect width='1' height='1' fill='#222222' fill-opacity='0.06'/></svg>"
    );

let settings = null;
let popupGlobal = null;

const POPUP_STYLE_ID = 'rss-feed-whats-new-styles';

const cssStyle = `
  .Rss-in-whats-new-SliderField {
    width: 100px;
  }
`;

async function SyncLog(textS: string) {
    await print_log({ text: textS });
}

function InjectPopupStyles(targetDocument: Document) {
    if (targetDocument.getElementById(POPUP_STYLE_ID)) {
        return;
    }

    const styleElement = targetDocument.createElement('style');
    styleElement.id = POPUP_STYLE_ID;
    styleElement.textContent = cssStyle;
    targetDocument.head.appendChild(styleElement);
}

function DecodeHtmlEntities(text: string): string {
    let current = text;

    while (true) {
        const el = document.createElement('textarea');
        el.innerHTML = current;
        const decoded = el.value;

        if (decoded === current) return decoded;

        current = decoded;
    }
}

function EscapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function RenderTitleHtml(title: string) {
    let result = EscapeHtml(DecodeHtmlEntities(title));

    // ===== english letters =====
    if (settings.highlite_english_letters) {
        const englishRegex =
            /\b[A-Za-z]+(?:[^\w<>]{1,3}[A-Za-z]+)+\b|\b[A-Za-z]+\b/g;

        result = result.replace(
            englishRegex,
            (match) =>
                `<span style="color:${settings.highlite_english_letters_color}">${match}</span>`
        );
    }

    // ===== numbers =====
    if (settings.highlite_numbers) {
        result = result.replace(
            /\b\d+\b/g,
            (match) =>
                `<span style="color:${settings.highlite_numbers_color}">${match}</span>`
        );
    }

    // ===== quotes =====
    if (settings.highlite_quotes) {
        const quotesRegex =
            /(?<![A-Za-z0-9=])(["'`«»])(.*?)(\1)(?![A-Za-z0-9>])/g;

        result = result.replace(
            quotesRegex,
            (match, open, content, close) => {
                return `<span style="color:${settings.highlite_quotes_color}">${open}${content}${close}</span>`;
            }
        );
    }

    return result;
}

// xmlToObject returns a plain string for a simple text node, but an object when
// the node also carries attributes or children. This flattens both shapes so a
// feed's markup never reaches the rendering code as a non-string.
function AsText(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return AsText(value[0]);
    if (typeof value === 'object') return AsText(value['#text']);

    return '';
}

function GetSourceLabel(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        const parts = hostname.split('.').filter(Boolean);

        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }

        return hostname || url;
    } catch {
        return url;
    }
}

function BuildSourceUrlList(): string[] {
    const primaryUrl = settings.rss_link === 'other' ? settings.custom_rss_link : settings.rss_link;

    const extraUrls = (settings.extra_rss_sources ?? []).map((source: RssSourceEntry) =>
        source.value === 'other' ? source.custom_value : source.value
    );

    const allUrls = [primaryUrl, ...extraUrls].map((url: string) => (url ?? '').trim()).filter(Boolean);

    return Array.from(new Set(allUrls));
}

// True for bodies that are plainly a web page rather than a feed: a blocked
// source (Cloudflare challenge, consent wall, error page) answers with HTML
// that would otherwise die in the XML parser.
function LooksLikeHtmlPage(body: string): boolean {
    const head = body.slice(0, 1000).toLowerCase();

    return head.includes('<!doctype html')
        || head.includes('<html')
        || head.includes('<head>')
        || head.includes('<body');
}

// Never throws: a source that cannot be downloaded or parsed simply
// contributes no items, so the remaining sources still render.
async function FetchSourceItems(url: string): Promise<any[]> {
    try {
        const body = await get_url_data({ url });

        if (!body || typeof body !== 'string' || body.trim() === '') {
            SyncLog(`source returned no data, skipping: ${url}`);
            return [];
        }

        if (LooksLikeHtmlPage(body)) {
            SyncLog(`source returned an HTML page instead of a feed, skipping: ${url}`);
            return [];
        }

        const parsed: any = xmlToObject(body);
        const rawItems = parsed?.channel?.item;
        const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

        if (items.length === 0) {
            SyncLog(`source contains no news items, skipping: ${url}`);
            return [];
        }

        return items.map((item: any) => ({ ...item, __sourceUrl: url }));
    }
    catch (error) {
        SyncLog(`failed to read source ${url}: ${error}`);
        return [];
    }
}

function CountLines(el: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(el);

    const tops = new Set(Array.from(range.getClientRects()).map(r => Math.round(r.top)));

    return tops.size || 1;
}

function FitTextElement(el: HTMLElement, maxLines: number) {
    let fontSize = parseFloat(window.getComputedStyle(el).fontSize);

    while (CountLines(el) > maxLines && fontSize > 1) {
        fontSize -= 1;
        el.style.fontSize = `${fontSize}px`;
    }
}

function FitNewsBlock(newsBlock: any) {
    FitTextElement(newsBlock.children[2], TITLE_MAX_LINES);
}

// XML predefines only &amp; &lt; &gt; &quot; &apos;, but feeds routinely use
// HTML entities on top of those. A strict XML parser rejects them outright, so
// the common ones are rewritten as numeric references it does understand.
const HTML_ENTITY_CODES: Record<string, number> = {
    nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren: 164, yen: 165,
    sect: 167, uml: 168, copy: 169, laquo: 171, not: 172, reg: 174,
    deg: 176, plusmn: 177, sup2: 178, sup3: 179, micro: 181, para: 182,
    middot: 183, frac14: 188, frac12: 189, frac34: 190, iquest: 191,
    raquo: 187, times: 215, divide: 247, ndash: 8211, mdash: 8212,
    lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221,
    bdquo: 8222, dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230,
    permil: 8240, prime: 8242, Prime: 8243, lsaquo: 8249, rsaquo: 8250,
    euro: 8364, trade: 8482,
};

const XML_BUILTIN_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function SanitizeXmlTextSegment(segment: string): string {
    return segment
        // Named entities: keep the five XML built-ins, translate known HTML
        // ones, and neutralise anything else so it survives as literal text.
        .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name: string) => {
            if (XML_BUILTIN_ENTITIES.has(name)) return match;

            const code = HTML_ENTITY_CODES[name];
            return code ? `&#${code};` : `&amp;${name};`;
        })
        // A bare '&' that starts no entity at all (e.g. in a raw query string).
        .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
        // A '<' that opens no tag, closing tag, comment/CDATA or instruction.
        .replace(/<(?![a-zA-Z\/!?])/g, '&lt;');
}

// Escapes stray characters that would abort parsing ("invalid element name"),
// leaving real markup and CDATA payloads untouched.
function EscapeStrayXmlChars(xml: string): string {
    const CDATA_OPEN = '<![CDATA[';
    const CDATA_CLOSE = ']]>';

    let result = '';
    let i = 0;

    while (i < xml.length) {
        const cdataStart = xml.indexOf(CDATA_OPEN, i);

        if (cdataStart === -1) {
            result += SanitizeXmlTextSegment(xml.slice(i));
            break;
        }

        result += SanitizeXmlTextSegment(xml.slice(i, cdataStart));

        const cdataContentEnd = xml.indexOf(CDATA_CLOSE, cdataStart + CDATA_OPEN.length);
        const cdataEndIndex = cdataContentEnd === -1 ? xml.length : cdataContentEnd + CDATA_CLOSE.length;

        result += xml.slice(cdataStart, cdataEndIndex);
        i = cdataEndIndex;
    }

    return result;
}

function xmlToObject(xmlStr: string) {
  const parser = new DOMParser();

  const normalizeXmlString = (raw: string) => {
    let value = (raw ?? "").trim().replace(/^\uFEFF/, "");

    const hasWrappingQuotes =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (hasWrappingQuotes) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    }

    value = value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .trim();

    const firstTagIndex = value.indexOf("<");
    if (firstTagIndex > 0) {
      value = value.slice(firstTagIndex);
    }

    return EscapeStrayXmlChars(value);
  };

  const normalizedXml = normalizeXmlString(xmlStr);
  const xmlDoc = parser.parseFromString(normalizedXml, "application/xml");

  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error(parseError.textContent || "Invalid XML");
  }

  function parseNode(node: any): any {
    const obj: Record<string, any> = {};

    if (node.attributes && node.attributes.length > 0) {
      obj["@attributes"] = {};
      Array.from(node.attributes as Attr[]).forEach((attr) => {
        obj["@attributes"][attr.nodeName] = attr.nodeValue;
      });
    }

    node.childNodes.forEach((child: any) => {
      if (child.nodeType === 1) {
        const childObj = parseNode(child);
        if (obj[child.nodeName]) {
          if (!Array.isArray(obj[child.nodeName])) obj[child.nodeName] = [obj[child.nodeName]];
          obj[child.nodeName].push(childObj);
        } else {
          obj[child.nodeName] = childObj;
        }
      } else if (child.nodeType === 3 || child.nodeType === 4) {
        const text = (child.nodeValue ?? "").trim();
        if (text) obj["#text"] = text;
      }
    });

    if (Object.keys(obj).length === 0) return null;
    if (Object.keys(obj).length === 1 && obj["#text"] !== undefined) return obj["#text"];

    return obj;
  }

  return parseNode(xmlDoc.documentElement);
}

function SpawnUpdateNewsButton(panel: HTMLElement) {
  if (panel.querySelector("#RSSNewsUpdateButton")) return;

  const svgOriginal = panel.querySelector<SVGElement>("svg");
  if (!svgOriginal) return;

  const parent = svgOriginal.parentElement;
  if (!parent) return;

  const clone = parent.cloneNode(true) as HTMLElement;
  clone.id = "RSSNewsUpdateButton";

  if (clone.firstElementChild) clone.firstElementChild.remove();

  const svgNew = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgOriginal.classList.forEach(cls => svgNew.classList.add(cls));
  svgNew.setAttribute("viewBox", "0 1 15 17");
  svgNew.setAttribute("id", "RSSNewsUpdateButtonSVG");

  svgNew.innerHTML = `
    <path d="M 4 2.5 L 3 3.5 L 3 8 L 7.5 8 L 8.5 7 L 4.6601562 7 L 5.4628906 6.0722656 L 5.7695312 5.7441406 L 6.0996094 5.4414062 L 6.4492188 5.1621094 L 6.8203125 4.9101562 L 7.2089844 4.6875 L 7.6152344 4.4941406 L 8.0332031 4.3300781 L 8.4609375 4.2011719 L 8.8984375 4.1015625 L 9.3417969 4.0351562 L 9.7890625 4.0039062 L 10.238281 4.0058594 L 10.685547 4.0390625 L 11.128906 4.1054688 L 11.564453 4.2070312 L 11.994141 4.3398438 L 12.410156 4.5058594 L 12.814453 4.7011719 L 13.201172 4.9257812 L 13.572266 5.1777344 L 13.921875 5.4589844 L 14.25 5.7636719 L 14.554688 6.09375 L 14.833984 6.4453125 L 15.083984 6.8164062 L 15.310547 7.2050781 L 15.501953 7.609375 L 15.666016 8.0273438 L 15.796875 8.4550781 L 15.896484 8.8925781 L 15.962891 9.3359375 L 15.994141 9.7851562 L 15.994141 10 L 17 10 L 17 9.9902344 L 16.982422 9.5058594 L 16.931641 9.0214844 L 16.847656 8.5449219 L 16.728516 8.0742188 L 16.580078 7.6113281 L 16.398438 7.1621094 L 16.185547 6.7265625 L 15.945312 6.3046875 L 15.675781 5.9023438 L 15.376953 5.5175781 L 15.054688 5.15625 L 14.707031 4.8183594 L 14.335938 4.5058594 L 13.945312 4.2167969 L 13.535156 3.9570312 L 13.109375 3.7285156 L 12.666016 3.5273438 L 12.210938 3.3574219 L 11.746094 3.2207031 L 11.271484 3.1152344 L 10.792969 3.0449219 L 10.306641 3.0058594 L 9.8222656 3 L 9.3378906 3.0292969 L 8.8574219 3.0917969 L 8.3808594 3.1894531 L 7.9140625 3.3183594 L 7.4550781 3.4785156 L 7.0097656 3.6699219 L 6.578125 3.8925781 L 6.1640625 4.1445312 L 5.7675781 4.4238281 L 5.390625 4.7304688 L 5.0371094 5.0605469 L 4.7070312 5.4179688 L 4 6.234375 L 4 2.5 z M 3 10 L 3 10.007812 L 3.0175781 10.492188 L 3.0683594 10.976562 L 3.1523438 11.453125 L 3.2714844 11.923828 L 3.4199219 12.386719 L 3.6015625 12.835938 L 3.8144531 13.271484 L 4.0546875 13.693359 L 4.3242188 14.095703 L 4.6230469 14.480469 L 4.9453125 14.841797 L 5.2929688 15.179688 L 5.6640625 15.492188 L 6.0546875 15.78125 L 6.4648438 16.041016 L 6.890625 16.269531 L 7.3339844 16.470703 L 7.7890625 16.640625 L 8.2539062 16.777344 L 8.7285156 16.882812 L 9.2070312 16.953125 L 9.6933594 16.992188 L 10.177734 16.998047 L 10.662109 16.96875 L 11.142578 16.90625 L 11.619141 16.808594 L 12.085938 16.679688 L 12.544922 16.519531 L 12.990234 16.328125 L 13.421875 16.105469 L 13.835938 15.853516 L 14.232422 15.574219 L 14.609375 15.267578 L 14.962891 14.9375 L 15.292969 14.580078 L 16 13.763672 L 16 17.498047 L 17 16.498047 L 17 11.998047 L 12.5 11.998047 L 11.5 12.998047 L 15.339844 12.998047 L 14.537109 13.925781 L 14.230469 14.253906 L 13.900391 14.556641 L 13.550781 14.835938 L 13.179688 15.087891 L 12.791016 15.310547 L 12.384766 15.503906 L 11.966797 15.667969 L 11.539062 15.796875 L 11.101562 15.896484 L 10.658203 15.962891 L 10.210938 15.994141 L 9.7617188 15.992188 L 9.3144531 15.958984 L 8.8710938 15.892578 L 8.4355469 15.791016 L 8.0058594 15.658203 L 7.5898438 15.492188 L 7.1855469 15.296875 L 6.7988281 15.072266 L 6.4277344 14.820312 L 6.078125 14.539062 L 5.75 14.234375 L 5.4453125 13.904297 L 5.1660156 13.552734 L 4.9160156 13.181641 L 4.6894531 12.792969 L 4.4980469 12.388672 L 4.3339844 11.970703 L 4.203125 11.542969 L 4.1035156 11.105469 L 4.0371094 10.662109 L 4.0058594 10.212891 L 4.0058594 10 L 3 10 z "/>
  `;

  clone.appendChild(svgNew);

  clone.addEventListener("click", () => {
    UpdateSettingsAndNews();
  });

  clone.style.marginLeft = "11px";

  clone.title = Localize(settings.language, 'UpdateRSSNews');

  parent.insertAdjacentElement("afterend", clone);

  const container = parent.parentElement;
  if (container) {
    container.style.display = "flex";
  }
}

function FindNewsList(popup: any) {
    const container = popup.m_popup.document.getElementById("popup_target");
    if (!container) return null;

    return container.querySelectorAll('[role="list"]')[0] ?? null;
}

// Wrapper so a failure anywhere in the render path stays contained: the feed
// simply keeps Steam's own news instead of surfacing an unhandled rejection.
async function SpawnRSS(popup: any) {
    try {
        await SpawnRSSUnsafe(popup);
    }
    catch {
        // Nothing actionable here - the next mutation retries the render.
    }
}

async function SpawnRSSUnsafe(popup: any) {
    let WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

    if (WideRightPanel == null || WideRightPanel == undefined) return;

    if (popup.m_popup.document.getElementById("RSSNewBlock") == undefined) 
    {
        WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

        if (WideRightPanel == null || WideRightPanel == undefined) 
          return;

        if (popup.m_popup.document.getElementById("RSSNewBlock") != undefined)
          return;

        const sourceUrls = BuildSourceUrlList();

        const parsedSources = await Promise.all(sourceUrls.map((url) => FetchSourceItems(url)));

        // The observer keeps calling us while the feeds are downloading, so a
        // parallel run may have finished first. Everything from here down is
        // synchronous, which makes this re-check an atomic claim on the render.
        if (popup.m_popup.document.getElementById("RSSNewBlock") != undefined)
          return;

        const newsCount = Number(settings.newsCount);

        const objectJson = parsedSources
            .flat()
            .sort((a: any, b: any) =>
                (new Date(AsText(b.pubDate)).getTime() || 0) - (new Date(AsText(a.pubDate)).getTime() || 0)
            )
            .slice(0, newsCount);

        if (objectJson.length === 0)
          return;

        const list = FindNewsList(popup);

        if (list == null || list == undefined)
          return;

        const elementToCopy = list.children[0];

        // Cloning one of our own already-rewritten blocks would produce broken
        // copies and feed the observer new mutations forever.
        if (elementToCopy == null || elementToCopy.id === "RSSNewBlock")
          return;

        let newsBlocksList = [];

        objectJson.forEach(element => {
            let dateStr = AsText(element.pubDate);

            const date = new Date(dateStr);
            const hasValidDate = !isNaN(date.getTime());

            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            const formattedDate = hasValidDate ? `${day}.${month}.${year} ${hours}:${minutes}` : '';
            const sourceLabel = GetSourceLabel(element.__sourceUrl);

            let image = "no image or error parsing";
            let description = "no description or error parsing";
            let title = "no title or error parsing";

            if (element["media:thumbnail"] != undefined)
                image = AsText(element["media:thumbnail"]) || AsText(element["media:thumbnail"]?.["@attributes"]?.url);
            else if (element.enclosure != undefined)
                image = AsText(element.enclosure?.["@attributes"]?.url);

            if (element.description != undefined)
                description = AsText(element.description).replace("[…]", "");

            if (element.title != undefined)
                title = AsText(element.title);

            if (description.length > 125) {
                description = description.slice(0, 125) + '…';
            }

            title = RenderTitleHtml(title);

            const link = AsText(element.link) || AsText(element.link?.["@attributes"]?.href);

            const newsBlock = elementToCopy.cloneNode(true);

            newsBlock.children[0].textContent = formattedDate
              ? `${formattedDate} | ${sourceLabel}`
              : sourceLabel;
            
            newsBlock.children[1].children[0].children[0].textContent = Localize(settings.language, 'RSSNewsTitle');

            newsBlock.children[1].children[0].children[1].textContent = description;

            const imageEl = newsBlock.children[1].children[1].children[0];
            imageEl.src = IMAGE_LOADING_PLACEHOLDER;

            const preloadImage = new Image();
            preloadImage.onload = () => { imageEl.src = image; };
            preloadImage.src = image;

            imageEl.style.cssText
              = "height: " + settings.images_height.toString() + "px; object-fit: cover;";

            newsBlock.children[1].children[1].removeChild(newsBlock.children[1].children[1].children[1]);

            if (newsBlock.children[1].children.length === 3) {
                newsBlock.children[1].children[2].remove();
            }

            newsBlock.removeChild(newsBlock.children[3]);

            const titleEl = newsBlock.children[2].children[0].children[0];
            titleEl.innerHTML = title;

            titleEl.style.cssText = "max-height: 75px !important; -webkit-line-clamp: 4 !important;"
              + (settings.override_base_text ? ` color: ${settings.override_base_text_color} !important;` : "");

            titleEl.addEventListener("click", async () => {
    			    SteamClient.System.OpenInSystemBrowser(link);
            });

            newsBlock.children[1].children[0].children[1].addEventListener("click", async () => {
    			    SteamClient.System.OpenInSystemBrowser(link);
            });

            newsBlock.children[1].children[1].addEventListener("click", async () => {
    			    SteamClient.System.OpenInSystemBrowser(link);
            });

            newsBlock.id = "RSSNewBlock";

            newsBlocksList.push(newsBlock);
        });

        const repeatEvery = Number(settings.alternateEveryNblocks);
        const newsBlocksRange = Number(settings.newsBlocksRange);

        if (repeatEvery === 0) {
            newsBlocksList.reverse().forEach(el => {
                list.insertBefore(el, list.firstChild);
                FitNewsBlock(el);
            });
            return;
        }

        let index = 0;
        let i = 0;

        while (i < newsBlocksList.length) {
            const slice = newsBlocksList.slice(i, i + newsBlocksRange);

            slice.forEach(el => {
                const children = list.children;
                const insertBeforeEl = children[index] || null;
                list.insertBefore(el, insertBeforeEl);
                FitNewsBlock(el);
                index++;
            });

            i += newsBlocksRange;

            index += repeatEvery;
        }

        SpawnUpdateNewsButton(WideRightPanel);
    }
}

const SCROLL_SPEED_MULTIPLIER = 20; // px/sec per settings.scroll_speed unit (0-10)
const SCROLL_END_PAUSE_MS = 3000; // how long to hold on the last card before jumping back to the start

let scrollOffset = 0;
let scrollList: HTMLElement | null = null;
let lastScrollFrameTime = 0;
let scrollPausedUntil = 0;

function TickAutoScroll(popup: any, time: number) {
    const delta = Math.min(50, Math.max(0, time - lastScrollFrameTime));
    lastScrollFrameTime = time;

    if (!scrollList || !scrollList.isConnected) {
        scrollList = FindNewsList(popup);
    }

    if (scrollList && settings.scroll_speed > 0) {
        scrollList.style.setProperty('overflow', 'visible', 'important');
        scrollList.style.setProperty('mask-image', 'none', 'important');

        const visibleWidth = scrollList.parentElement?.clientWidth || 0;
        const maxScroll = Math.max(0, scrollList.scrollWidth - visibleWidth);

        if (maxScroll > 0) {
            if (time < scrollPausedUntil) {
                // holding on the last card - don't move
            } else if (scrollOffset >= maxScroll) {
                scrollOffset = 0;
                scrollList.style.transform = `translateX(0px)`;
            } else {
                scrollOffset = Math.min(maxScroll, scrollOffset + (settings.scroll_speed * SCROLL_SPEED_MULTIPLIER * delta) / 1000);
                scrollList.style.transform = `translateX(-${scrollOffset}px)`;

                if (scrollOffset >= maxScroll) {
                    scrollPausedUntil = time + SCROLL_END_PAUSE_MS;
                }
            }
        }
    } else if (scrollList) {
        scrollList.style.removeProperty('overflow');
        scrollList.style.removeProperty('mask-image');
        scrollList.style.removeProperty('transform');

        scrollOffset = 0;
        scrollPausedUntil = 0;
    }

    popup.m_popup.window.requestAnimationFrame((nextTime: number) => TickAutoScroll(popup, nextTime));
}

async function OnPopupCreation(popup: any) {
    if (popup.m_strName === "SP Desktop_uid0") {
        popupGlobal = popup;

        InjectPopupStyles(popup.m_popup.document);

        if (settings.disable_news_section) {
            const updatesContainer = await WaitForElement('[class*="UpdatesContainer"]', popup.m_popup.document);
            updatesContainer?.remove();
            return;
        }

        const WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

        if (WideRightPanel == null || WideRightPanel == undefined) return;

        const WideRightPanelParent = WideRightPanel.parentElement.parentElement;

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === "childList") {
                    SpawnRSS(popup);
                }
            }
        });

        observer.observe(WideRightPanelParent, {
            childList: true,
            subtree: true
        });

        SpawnRSS(popup);

        popup.m_popup.window.requestAnimationFrame((time: number) => TickAutoScroll(popup, time));
    }
}

function UpdateSettingsAndNews() {
    settings = getSettings();

    if (popupGlobal.m_popup.document.getElementById("RSSNewBlock") != undefined){
        while (popupGlobal.m_popup.document.getElementById("RSSNewBlock") != undefined){
            const el = popupGlobal.m_popup.document.getElementById("RSSNewBlock");
            el.remove();
        }
    }

    SpawnRSS(popupGlobal)
}

const SettingsContent = () => {
  const [language, setLanguage] = useState('English');
  const [newsCount, setNewsCount] = useState('10');
  const [alternateEveryNblocks, setAlternateEveryNblocks] = useState('1');
  const [newsBlocksRange, setNewsBlocksRange] = useState('2');
  const [disable_news_section, set_disable_news_section] = useState(false);
  const [override_base_text, set_override_base_text] = useState(false);
  const [override_base_text_color, set_override_base_text_color] = useState('#ffffff80');
  const [highlite_english_letters, set_highlite_english_letters] = useState(false);
  const [highlite_english_letters_color, set_highlite_english_letters_color] = useState('#ffffff');
  const [highlite_numbers, set_highlite_numbers] = useState(true);
  const [highlite_numbers_color, set_highlite_numbers_color] = useState('#ffffff');
  const [highlite_quotes, set_highlite_quotes] = useState(true);
  const [highlite_quotes_color, set_highlite_quotes_color] = useState('#ffffff');
  const [rss_link, set_rss_link] = useState('http://feeds.feedburner.com/ign/games-all');
  const [custom_rss_link, set_custom_rss_link] = useState('http://feeds.feedburner.com/ign/games-all');
  const [images_height, set_images_height] = useState('135');
  const [scroll_speed, set_scroll_speed] = useState('0');
  const [extra_rss_sources, set_extra_rss_sources] = useState<RssSourceEntry[]>([]);

  useEffect(() => {
    const settings = getSettings();
    setLanguage(String(settings.language));
    setNewsCount(String(settings.newsCount));
    setAlternateEveryNblocks(String(settings.alternateEveryNblocks));
    setNewsBlocksRange(String(settings.newsBlocksRange));
    set_disable_news_section(settings.disable_news_section);
    set_override_base_text(settings.override_base_text);
    set_override_base_text_color(settings.override_base_text_color);
    set_highlite_english_letters(settings.highlite_english_letters);
    set_highlite_english_letters_color(settings.highlite_english_letters_color);
    set_highlite_numbers(settings.highlite_numbers);
    set_highlite_numbers_color(settings.highlite_numbers_color);
    set_highlite_quotes(settings.highlite_quotes);
    set_highlite_quotes_color(settings.highlite_quotes_color);
    set_rss_link(settings.rss_link);
    set_custom_rss_link(settings.custom_rss_link);
    set_images_height(String(settings.images_height));
    set_scroll_speed(String(settings.scroll_speed));
    set_extra_rss_sources(settings.extra_rss_sources ?? []);
  }, []);

  const onlanguageChange = (value: string) => {
    setLanguage(value);
    saveSettings({ ...getSettings(), language: value });
    UpdateSettingsAndNews();
  };

  const onNewsCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewsCount(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      saveSettings({ ...getSettings(), newsCount: numValue });
      UpdateSettingsAndNews();
    }
  };

  const onAlternateEveryNblocksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAlternateEveryNblocks(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      saveSettings({ ...getSettings(), alternateEveryNblocks: numValue });
      UpdateSettingsAndNews();
    }
  };

  const onNewsBlocksRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewsBlocksRange(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      saveSettings({ ...getSettings(), newsBlocksRange: numValue });
      UpdateSettingsAndNews();
    }
  };

  const ondisable_news_sectionChange = (checked: boolean) => {
    set_disable_news_section(checked);
    saveSettings({ ...getSettings(), disable_news_section: checked });
  };

  const onoverride_base_textChange = (checked: boolean) => {
    set_override_base_text(checked);
    saveSettings({ ...getSettings(), override_base_text: checked });
    UpdateSettingsAndNews();
  };

  const onoverride_base_text_colorChange = (value: string) => {
    set_override_base_text_color(value);
    saveSettings({ ...getSettings(), override_base_text_color: value });
    UpdateSettingsAndNews();
  };

  const onhighlite_english_lettersChange = (checked: boolean) => {
    set_highlite_english_letters(checked);
    saveSettings({ ...getSettings(), highlite_english_letters: checked });
    UpdateSettingsAndNews();
  };

  const onhighlite_english_letters_colorChange = (value: string) => {
    set_highlite_english_letters_color(value);
    saveSettings({ ...getSettings(), highlite_english_letters_color: value });
    UpdateSettingsAndNews();
  };

  const onhighlite_numbersChange = (checked: boolean) => {
    set_highlite_numbers(checked);
    saveSettings({ ...getSettings(), highlite_numbers: checked });
    UpdateSettingsAndNews();
  };

  const onhighlite_numbers_colorChange = (value: string) => {
    set_highlite_numbers_color(value);
    saveSettings({ ...getSettings(), highlite_numbers_color: value });
    UpdateSettingsAndNews();
  };

  const onhighlite_quotesChange = (checked: boolean) => {
    set_highlite_quotes(checked);
    saveSettings({ ...getSettings(), highlite_quotes: checked });
    UpdateSettingsAndNews();
  };

  const onhighlite_quotes_colorChange = (value: string) => {
    set_highlite_quotes_color(value);
    saveSettings({ ...getSettings(), highlite_quotes_color: value });
    UpdateSettingsAndNews();
  };

  const onrss_linkChange = (value: string) => {
    set_rss_link(value);
    saveSettings({ ...getSettings(), rss_link: value });
    UpdateSettingsAndNews();
  };

  const oncustom_rss_linkChange = (value: string) => {
    set_custom_rss_link(value);
    saveSettings({ ...getSettings(), custom_rss_link: value });
    UpdateSettingsAndNews();
  };

  const onAddRssSource = () => {
    const newSource: RssSourceEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      value: rssOptions[0].data,
      custom_value: rssOptions[0].data,
    };
    const updated = [...extra_rss_sources, newSource];
    set_extra_rss_sources(updated);
    saveSettings({ ...getSettings(), extra_rss_sources: updated });
    UpdateSettingsAndNews();
  };

  const onRemoveRssSource = (id: string) => {
    const updated = extra_rss_sources.filter((source) => source.id !== id);
    set_extra_rss_sources(updated);
    saveSettings({ ...getSettings(), extra_rss_sources: updated });
    UpdateSettingsAndNews();
  };

  const onRssSourceValueChange = (id: string, value: string) => {
    const updated = extra_rss_sources.map((source) =>
      source.id === id ? { ...source, value } : source
    );
    set_extra_rss_sources(updated);
    saveSettings({ ...getSettings(), extra_rss_sources: updated });
    UpdateSettingsAndNews();
  };

  const onRssSourceCustomValueChange = (id: string, value: string) => {
    const updated = extra_rss_sources.map((source) =>
      source.id === id ? { ...source, custom_value: value } : source
    );
    set_extra_rss_sources(updated);
    saveSettings({ ...getSettings(), extra_rss_sources: updated });
    UpdateSettingsAndNews();
  };

  const onimages_heightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    set_images_height(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 300) {
      saveSettings({ ...getSettings(), images_height: numValue });
      UpdateSettingsAndNews();
    }
  };

  const onscroll_speedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    set_scroll_speed(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      saveSettings({ ...getSettings(), scroll_speed: numValue });
      UpdateSettingsAndNews();
    }
  };

  const rssOptions = [
    { data: 'http://feeds.feedburner.com/ign/games-all', label: 'English (ign) - http://feeds.feedburner.com/ign/games-all' },
    { data: 'https://www.playground.ru/rss/news.xml', label: 'Русский (playground) - https://www.playground.ru/rss/news.xml' },
    { data: 'https://rss.stopgame.ru/rss_news.xml', label: 'Русский (stopgame) - https://rss.stopgame.ru/rss_news.xml' },
    { data: 'https://www.gamestar.de/news/rss/news.rss', label: 'Deutsch (gamestar) - https://www.gamestar.de/news/rss/news.rss' },
    { data: 'https://de.ign.com/feed.xml', label: 'Deutsch (ign) - https://de.ign.com/feed.xml' },
    { data: 'https://www.gameblog.fr/rssmap/rss_all.xml', label: 'Français (gameblog) - https://www.gameblog.fr/rssmap/rss_all.xml' },
    { data: 'https://fr.ign.com/news.xml', label: 'Français (ign) - https://fr.ign.com/news.xml' },
    { data: 'https://it.ign.com/news.xml', label: 'Italian (ign) - https://it.ign.com/news.xml' },
    { data: 'https://br.ign.com/news.xml', label: 'Português (ign) - https://br.ign.com/news.xml' },
    { data: 'https://jp.ign.com/news.xml', label: '日本語 (ign) - https://jp.ign.com/news.xml' },
    { data: 'https://kr.ign.com/news.xml', label: '한국어 (ign) - https://kr.ign.com/news.xml' },
    { data: 'https://nl.ign.com/news.xml', label: 'Nederlands (ign) - https://nl.ign.com/news.xml' },
    { data: 'other', label: Localize(language, 'Other') },
  ];

  const selectedRssOption =
    rssOptions.find((option) => option.data === rss_link) ?? rssOptions[0];

  const languageOptions = GetLanguageOptions();

  const selectedlanguageOption =
    languageOptions.find((option) => option.data === language) ?? languageOptions[0];

  return (
    <>
      <PanelSection 
        title={Localize(language, 'LanguageOfPlugin')}
      >
        <DropdownItem
          label={selectedlanguageOption.label}
          bottomSeparator="standard"
          rgOptions={languageOptions}
          selectedOption={selectedlanguageOption}
          menuLabel={selectedlanguageOption.label}
          strDefaultLabel={selectedlanguageOption.label}
          onChange={(selected) => onlanguageChange(String(selected.data))}
        />
      </PanelSection>

      <PanelSection
        title={Localize(language, 'DisableNewsSection')}
      >
        <Field label={Localize(language, 'DisableNewsSection')} description={Localize(language, 'DisableNewsSectionDescription')} bottomSeparator="standard">
          <Toggle
            value={disable_news_section}
            onChange={ondisable_news_sectionChange}
          />
        </Field>
      </PanelSection>

      <PanelSection
        title={`${Localize(language, 'NewsCount')}: ${newsCount}`}
      >
        <TextField
          description={Localize(language, 'NewsCountDescription')}
          mustBeNumeric={true}
          rangeMin={1}
          rangeMax={20}
          value={newsCount}
          onChange={onNewsCountChange}
        />
      </PanelSection>
      <PanelSection 
        title={`${Localize(language, 'AlternateEveryNBlocks')}: ${alternateEveryNblocks}`}
      >
        <TextField
          description={Localize(language, 'AlternateEveryNBlocksDescription')}
          mustBeNumeric={true}
          rangeMin={0}
          rangeMax={10}
          value={alternateEveryNblocks}
          onChange={onAlternateEveryNblocksChange}
        />
      </PanelSection>
      <PanelSection 
        title={`${Localize(language, 'NewsBlocksRange')}: ${newsBlocksRange}`}
      >
        <TextField
          description={Localize(language, 'NewsBlocksRangeDescription')}
          mustBeNumeric={true}
          rangeMin={1}
          rangeMax={20}
          value={newsBlocksRange}
          onChange={onNewsBlocksRangeChange}
        />
      </PanelSection>

      <br></br>

      <PanelSection
        title={Localize(language, 'OverrideBaseTextColor')}
      >
        <Field label={Localize(language, 'OverrideBaseTextColor')} description={Localize(language, 'OverrideBaseTextColorDescription')} bottomSeparator="standard">
          <Toggle
            value={override_base_text}
            onChange={onoverride_base_textChange}
          />
        </Field>
        <br></br>
        <TextField
          label={Localize(language, 'OverrideBaseTextColorColor')}
          value={override_base_text_color}
          onChange={(e) => onoverride_base_text_colorChange(e.target.value)}
        />
      </PanelSection>

      <PanelSection
        title={Localize(language, 'HighliteEnglishLetters')}
      >
        <Field label={Localize(language, 'HighliteEnglishLetters')} description={Localize(language, 'HighliteEnglishLettersDescription')} bottomSeparator="standard">
          <Toggle
            value={highlite_english_letters}
            onChange={onhighlite_english_lettersChange}
          />
        </Field>
        <br></br>
        <TextField
          label={Localize(language, 'HighliteEnglishLettersColor')}
          value={highlite_english_letters_color}
          onChange={(e) => onhighlite_english_letters_colorChange(e.target.value)}
        />
      </PanelSection>

      <PanelSection 
        title={Localize(language, 'HighliteNumbers')}
      > 
        <Field label={Localize(language, 'HighliteNumbers')} description={Localize(language, 'HighliteNumbersDescription')} bottomSeparator="standard">
          <Toggle
            value={highlite_numbers}
            onChange={onhighlite_numbersChange}
          />
        </Field>
        <br></br>
        <TextField
          label={Localize(language, 'HighliteNumbersColor')}
          value={highlite_numbers_color}
          onChange={(e) => onhighlite_numbers_colorChange(e.target.value)}
        />
      </PanelSection>
      
      <PanelSection 
        title={Localize(language, 'HighliteQuotes')}
      > 
        <Field label={Localize(language, 'HighliteQuotes')} description={Localize(language, 'HighliteQuotesDescription')} bottomSeparator="standard">
          <Toggle
            value={highlite_quotes}
            onChange={onhighlite_quotesChange}
          />
        </Field>
        <br></br>
        <TextField
          label={Localize(language, 'HighliteQuotesColor')}
          value={highlite_quotes_color}
          onChange={(e) => onhighlite_quotes_colorChange(e.target.value)}
        />
      </PanelSection>

      <PanelSection 
        title={Localize(language, 'ImagesHeight')}
      >
        <TextField
          description={Localize(language, 'ImagesHeightDescription')}
          mustBeNumeric={true}
          rangeMin={1}
          rangeMax={300}
          value={images_height}
          onChange={onimages_heightChange}
        />
      </PanelSection>

      <PanelSection
        title={`${Localize(language, 'ScrollSpeed')}: ${scroll_speed}`}
      >
        <TextField
          description={Localize(language, 'ScrollSpeedDescription')}
          mustBeNumeric={true}
          rangeMin={0}
          rangeMax={10}
          value={scroll_speed}
          onChange={onscroll_speedChange}
        />
      </PanelSection>

      <PanelSection
        title={Localize(language, 'RSSFeedLink')}
      >
        <p>{Localize(language, 'RSSFeedLinkDescription')}</p>
        <DropdownItem
          label={selectedRssOption.label}
          bottomSeparator="standard"
          rgOptions={rssOptions}
          selectedOption={selectedRssOption}
          menuLabel={selectedRssOption.label}
          strDefaultLabel={selectedRssOption.label}
          onChange={(selected) => onrss_linkChange(String(selected.data))}
        />
      </PanelSection>

      {
        rss_link == "other" &&
        <>
          <p>
            {Localize(language, 'CustomRSSLinkDescription')}
          </p>
          <TextField
            label={Localize(language, 'CustomRSSLink')}
            value={custom_rss_link}
            onChange={(e) => oncustom_rss_linkChange(e.target.value)}
          />
        </>
      }

      {extra_rss_sources.map((source, index) => {
        const selectedExtraOption =
          rssOptions.find((option) => option.data === source.value) ?? rssOptions[0];

        return (
          <PanelSection
            key={source.id}
            title={`${Localize(language, 'AdditionalRssSources')} #${index + 1}`}
          >
            <DropdownItem
              label={selectedExtraOption.label}
              bottomSeparator="none"
              rgOptions={rssOptions}
              selectedOption={selectedExtraOption}
              menuLabel={selectedExtraOption.label}
              strDefaultLabel={selectedExtraOption.label}
              onChange={(selected) => onRssSourceValueChange(source.id, String(selected.data))}
            />
            {
              source.value === 'other' &&
              <TextField
                label={Localize(language, 'CustomRSSLink')}
                value={source.custom_value}
                onChange={(e) => onRssSourceCustomValueChange(source.id, e.target.value)}
              />
            }
            <DialogButton onClick={() => onRemoveRssSource(source.id)}>
              {Localize(language, 'RemoveRssSource')}
            </DialogButton>
          </PanelSection>
        );
      })}

      <PanelSection
        title={extra_rss_sources.length === 0 ? Localize(language, 'AdditionalRssSources') : undefined}
      >
        <DialogButton onClick={onAddRssSource}>
          {Localize(language, 'AddRssSource')}
        </DialogButton>
      </PanelSection>
    </>
  );
};

export default definePlugin(() => {
  SyncLog("Plugin loaded");
  
  settings = getSettings();

	Millennium.AddWindowCreateHook(OnPopupCreation);

	return {
		title: 'RSS feed in Whats New',
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});
