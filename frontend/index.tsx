import { Millennium, IconsModule, definePlugin, callable, Field, DialogButton } from '@steambrew/client';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from './services/settings';

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const get_url_data = callable<[{ url: string }], string>('get_url_data');
const print_log = callable<[{ text: string }], string>('print_log');
const print_error = callable<[{ text: string }], string>('print_error');

async function SyncLog(textS: string) {
    await print_log({ text: textS });
}

let settings = null;
let popupGlobal = null;

function ChangeTitle(result: string) {
    if (result.length > 125) {
        result = result.slice(0, 125) + '…';
    }

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

    // ===== HTML entities cleanup =====
    result = result
        .replace(/&amp;#039;/g, "'")
        .replace(/&#039;/g, "'")
        .replace(/&amp;amp;/g, "&")
        .replace(/&amp;/g, "&");

    return result;
}

function isCharacterALetter(char) {
	return (/[a-zA-Z]/).test(char)
}

function isCharacterNumber(char) {
	return (/[0-9]/).test(char)
}

function xmlToObject(xmlStr) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "application/xml");

  function parseNode(node) {
    const obj = {};

    // атрибуты
    if (node.attributes && node.attributes.length > 0) {
      obj["@attributes"] = {};
      Array.from(node.attributes).forEach(attr => {
        obj["@attributes"][attr.nodeName] = attr.nodeValue;
      });
    }

    node.childNodes.forEach(child => {
      if (child.nodeType === 1) { // элемент
        const childObj = parseNode(child);
        if (obj[child.nodeName]) {
          if (!Array.isArray(obj[child.nodeName])) obj[child.nodeName] = [obj[child.nodeName]];
          obj[child.nodeName].push(childObj);
        } else {
          obj[child.nodeName] = childObj;
        }
      } else if (child.nodeType === 3 || child.nodeType === 4) { // текст или CDATA
        const text = child.nodeValue.trim();
        if (text) obj["#text"] = text;
      }
    });

    // если объект пустой
    if (Object.keys(obj).length === 0) return null;
    // если только текст
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

  clone.title = "Update RSS news";

  parent.insertAdjacentElement("afterend", clone);

  const container = parent.parentElement;
  if (container) {
    container.style.display = "flex";
  }
}

async function SpawnRSS(popup: any) {
    SyncLog("try to spawn rss");

    let WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

    if (WideRightPanel == null || WideRightPanel == undefined) return;

    if (popup.m_popup.document.getElementById("RSSNewBlock") == undefined) 
    {
        SyncLog("start spawn rss");

        let result = "";

        if (settings.rss_link == "other")
        {
          result = await get_url_data({ url: settings.custom_rss_link });
        }
        else {
          result = await get_url_data({ url: settings.rss_link });
        }

        if (popup.m_popup.document.getElementById("RSSNewBlock") != undefined)
        {
          return;
        }

        WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

        SpawnUpdateNewsButton(WideRightPanel);

        if (WideRightPanel == null || WideRightPanel == undefined) return;

        SyncLog("Answer on rss was get");

        let objectJson = {};

        try{
            objectJson = xmlToObject(result);
        }
        catch (error) {
            SyncLog("EROOR: " + error);
            await print_error({ text: "EROOR: " + error });
            return;
        }

        SyncLog("objectJson corrected convert");

        console.log("objectJson corrected convert")
        console.log(objectJson)

        const newsCount = Number(settings.newsCount);

        objectJson = objectJson.channel.item.slice(0, newsCount + 1);

        const container = popup.m_popup.document.getElementById("popup_target");
        const list = container.querySelectorAll('[role="list"]')[0];
        const elementToCopy = list.children[0];

        let newsBlocksList = [];

        objectJson.forEach(element => {
            let dateStr = element.pubDate;

            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            const formattedDate = `${day}.${month}.${year} ${hours}:${minutes}`;

            let image = "no image or error parsing";
            let description = "no description or error parsing";
            let title = "no title or error parsing";

            if (element["media:thumbnail"] != undefined)
                image = element["media:thumbnail"];
            else if (element.enclosure != undefined)
                image = element.enclosure["@attributes"].url;

            if (element.description != undefined)
                description = element.description.replace("[…]", "");

            if (element.title != undefined)
                title = element.title;

            if (description.length > 125) {
                description = description.slice(0, 125) + '…';
            }

            title = ChangeTitle(title);

            const link = element.link;

            const newsBlock = elementToCopy.cloneNode(true);
            newsBlock.children[0].textContent = formattedDate;
            
            newsBlock.children[1].children[0].children[0].textContent = "RSS News";

            newsBlock.children[1].children[0].children[1].textContent = description;

            newsBlock.children[1].children[1].children[0].src = image;
            newsBlock.children[1].children[1].children[0].style.cssText = "height: 135px; object-fit: cover;";

            newsBlock.children[1].children[1].removeChild(newsBlock.children[1].children[1].children[1]);

            if (newsBlock.children[1].children.length === 3) {
                newsBlock.children[1].children[2].remove();
            }

            newsBlock.removeChild(newsBlock.children[3]);
            newsBlock.children[2].innerHTML = title;

            newsBlock.children[1].children[1].addEventListener("click", async () => {
    			SteamClient.System.OpenInSystemBrowser(link);
            });

            newsBlock.id = "RSSNewBlock";

            newsBlocksList.push(newsBlock);
        });

        const repeatEvery = Number(settings.alternateEveryNblocks);
        const newsBlocksRange = Number(settings.newsBlocksRange);

        if (repeatEvery === 0) {
            newsBlocksList.reverse().forEach(el => list.insertBefore(el, list.firstChild));
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
                index++; 
            });

            i += newsBlocksRange;

            index += repeatEvery;
        }
    }
}

async function OnPopupCreation(popup: any) {
    SyncLog("OnPopupCreation");

    if (popup.m_strName === "SP Desktop_uid0") {
        popupGlobal = popup;
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
  const [newsCount, setNewsCount] = useState('10');
  const [alternateEveryNblocks, setAlternateEveryNblocks] = useState('1');
  const [newsBlocksRange, setNewsBlocksRange] = useState('2');
  const [highlite_english_letters, set_highlite_english_letters] = useState(false);
  const [highlite_english_letters_color, set_highlite_english_letters_color] = useState('#ffffff');
  const [highlite_numbers, set_highlite_numbers] = useState(true);
  const [highlite_numbers_color, set_highlite_numbers_color] = useState('#ffffff');
  const [highlite_quotes, set_highlite_quotes] = useState(true);
  const [highlite_quotes_color, set_highlite_quotes_color] = useState('#ffffff');
  const [rss_link, set_rss_link] = useState('http://feeds.feedburner.com/ign/games-all');
  const [custom_rss_link, set_custom_rss_link] = useState('http://feeds.feedburner.com/ign/games-all');

  useEffect(() => {
    const settings = getSettings();
    setNewsCount(String(settings.newsCount));
    setAlternateEveryNblocks(String(settings.alternateEveryNblocks));
    setNewsBlocksRange(String(settings.newsBlocksRange));
    set_highlite_english_letters(settings.highlite_english_letters);
    set_highlite_english_letters_color(settings.highlite_english_letters_color);
    set_highlite_numbers(settings.highlite_numbers);
    set_highlite_numbers_color(settings.highlite_numbers_color);
    set_highlite_quotes(settings.highlite_quotes);
    set_highlite_quotes_color(settings.highlite_quotes_color);
    set_rss_link(settings.rss_link);
    set_custom_rss_link(settings.custom_rss_link);
  }, []);

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
  
  return (
    <>
      <Field label="News Count" description="Number of news items to display" bottomSeparator="standard">
        <input
          type="number"
          min={1}
          max={20}
          value={newsCount}
          onChange={onNewsCountChange}
          style={{ width: '60px', padding: '4px 8px' }}
        />
      </Field>
      <Field label="Alternate every N blocks" description="Interval between RSS news and Steam news" bottomSeparator="standard">
        <input
          type="number"
          min={0}
          max={20}
          value={alternateEveryNblocks}
          onChange={onAlternateEveryNblocksChange}
          style={{ width: '60px', padding: '4px 8px' }}
        />
      </Field>
      <Field label="News blocks range" description="Number of consecutive RSS news blocks to insert" bottomSeparator="standard">
        <input
          type="number"
          min={1}
          max={20}
          value={newsBlocksRange}
          onChange={onNewsBlocksRangeChange}
          style={{ width: '60px', padding: '4px 8px' }}
        />
      </Field>
      <Field label="Highlite english letters" description="Whether to highlight English letters within headlines (useful if the news is not in English)" bottomSeparator="standard">
        <input
          type="checkbox"
          checked={highlite_english_letters}
          onChange={(e) => onhighlite_english_lettersChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Highlite english letters color" description="" bottomSeparator="standard">
        <input
          type="text"
          value={highlite_english_letters_color}
          onChange={(e) => onhighlite_english_letters_colorChange(e.target.value)}
          style={{ width: '60px', height: '20px' }}
        />
      </Field>
      <Field label="Highlite numbers" description="Whether to highlight numbers within headlines" bottomSeparator="standard">
        <input
          type="checkbox"
          checked={highlite_numbers}
          onChange={(e) => onhighlite_numbersChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Highlite numbers color" description="" bottomSeparator="standard">
        <input
          type="text"
          value={highlite_numbers_color}
          onChange={(e) => onhighlite_numbers_colorChange(e.target.value)}
          style={{ width: '60px', height: '20px' }}
        />
      </Field>
      <Field label="Highlite quotes" description="Whether to highlight text enclosed in quotation marks within headlines" bottomSeparator="standard">
        <input
          type="checkbox"
          checked={highlite_quotes}
          onChange={(e) => onhighlite_quotesChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Highlite quotes color" description="" bottomSeparator="standard">
        <input
          type="text"
          value={highlite_quotes_color}
          onChange={(e) => onhighlite_quotes_colorChange(e.target.value)}
          style={{ width: '60px', height: '20px' }}
        />
      </Field>
      <Field label="RSS" description="Selecting a news source. Can be entered manually by selecting the 'other' option" bottomSeparator="standard">
        <select
            value={rss_link}
            onChange={(e) => onrss_linkChange(e.target.value)}
            style={{ width: '270px', height: '30px' }}
        >
            <option value="http://feeds.feedburner.com/ign/games-all">English (ign) - http://feeds.feedburner.com/ign/games-all</option>
            <option value="https://www.playground.ru/rss/news.xml">Русский (playground) - https://www.playground.ru/rss/news.xml</option>
            <option value="https://rss.stopgame.ru/rss_news.xml">Русский (stopgame) - https://rss.stopgame.ru/rss_news.xml</option>
            <option value="https://www.gamestar.de/news/rss/news.rss">Deutsch (gamestar) - https://www.gamestar.de/news/rss/news.rss</option>
            <option value="https://de.ign.com/feed.xml">Deutsch (ign) - https://de.ign.com/feed.xml</option>
            <option value="https://www.gameblog.fr/rssmap/rss_all.xml">Français (gameblog) - https://www.gameblog.fr/rssmap/rss_all.xml</option>
            <option value="https://fr.ign.com">Français (ign) - https://fr.ign.com</option>
            <option value="https://it.ign.com/news.xml">Italian (ign) - https://it.ign.com/news.xml</option>
            <option value="https://br.ign.com/news.xml">Português (ign) - https://br.ign.com</option>
            <option value="https://jp.ign.com/news.xml">日本語 (ign) - https://jp.ign.com</option>
            <option value="https://kr.ign.com/news.xml">한국어 (ign) - https://kr.ign.com</option>
            <option value="https://nl.ign.com/news.xml">Nederlands (ign) - https://nl.ign.com</option>
            <option value="other">other</option>
        </select>
      </Field>
    {
        settings.rss_link == "other" &&
        <Field label="Custom RSS link" description="You can insert your own link into your RSS. If something is not displayed correctly, please notify the plugin developer." bottomSeparator="standard">
            <input
                type="text"
                value={custom_rss_link}
                onChange={(e) => oncustom_rss_linkChange(e.target.value)}
                style={{ width: '230px', height: '20px' }}
            />
        </Field>
    }
    </>
  );
};

export default definePlugin(() => {
    settings = getSettings();
	Millennium.AddWindowCreateHook(OnPopupCreation);

	return {
		title: 'RSS feed in Whats New',
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});
