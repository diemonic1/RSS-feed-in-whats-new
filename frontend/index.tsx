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

function UpdateSettings() {
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
      UpdateSettings();
    }
  };

  const onAlternateEveryNblocksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAlternateEveryNblocks(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      saveSettings({ ...getSettings(), alternateEveryNblocks: numValue });
      UpdateSettings();
    }
  };

  const onNewsBlocksRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewsBlocksRange(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      saveSettings({ ...getSettings(), newsBlocksRange: numValue });
      UpdateSettings();
    }
  };

  const onhighlite_english_lettersChange = (checked: boolean) => {
    set_highlite_english_letters(checked);
    saveSettings({ ...getSettings(), highlite_english_letters: checked });
    UpdateSettings();
  };

  const onhighlite_english_letters_colorChange = (value: string) => {
    set_highlite_english_letters_color(value);
    saveSettings({ ...getSettings(), highlite_english_letters_color: value });
    UpdateSettings();
  };

  const onhighlite_numbersChange = (checked: boolean) => {
    set_highlite_numbers(checked);
    saveSettings({ ...getSettings(), highlite_numbers: checked });
    UpdateSettings();
  };

  const onhighlite_numbers_colorChange = (value: string) => {
    set_highlite_numbers_color(value);
    saveSettings({ ...getSettings(), highlite_numbers_color: value });
    UpdateSettings();
  };

  const onhighlite_quotesChange = (checked: boolean) => {
    set_highlite_quotes(checked);
    saveSettings({ ...getSettings(), highlite_quotes: checked });
    UpdateSettings();
  };

  const onhighlite_quotes_colorChange = (value: string) => {
    set_highlite_quotes_color(value);
    saveSettings({ ...getSettings(), highlite_quotes_color: value });
    UpdateSettings();
  };

  const onrss_linkChange = (value: string) => {
    set_rss_link(value);
    saveSettings({ ...getSettings(), rss_link: value });
    UpdateSettings();
  };

  const oncustom_rss_linkChange = (value: string) => {
    set_custom_rss_link(value);
    saveSettings({ ...getSettings(), custom_rss_link: value });
    UpdateSettings();
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
