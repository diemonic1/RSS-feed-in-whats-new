import {callable, Millennium, sleep } from "@steambrew/client";

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const call_back = callable<[{ app_path: string }], string>('Backend.call_back');
const get_url_data = callable<[{ url: string }], string>('Backend.get_url_data');
const print_log = callable<[{ text: string }], string>('Backend.print_log');
const print_error = callable<[{ text: string }], string>('Backend.print_error');
const get_settings = callable<[{}], string>('Backend.get_settings');

async function SyncLog(textS: string) {
    await print_log({ text: textS });
}

let global_object_settings = "";

function ChangeTitle(s: string, object_settings: any) {

    if (s.length > 125) {
        s = s.slice(0, 125) + '…';
    }

    while (s.includes("&amp;#039;")) {
		s = s.replace("&amp;#039;", "'");
	}
    while (s.includes("&#039;")) {
		s = s.replace("&#039;", "'");
	}
	while (s.includes("&amp;amp;")) {
		s = s.replace("&amp;amp;", "&");
	}
	while (s.includes("&amp;")) {
		s = s.replace("&amp;", "&");
	}

	let answer = "";
	let flag = false;

    if (object_settings.highlite_english_letter == "true") {
        for (let i = 0; i < s.length; i++) {
            if (isCharacterALetter(s[i]) && flag == false) {
                flag = true;
                answer += '<span style="color:' + object_settings.highlite_english_letters_color + '">' + s[i];
            }
            else if (isCharacterALetter(s[i]) && flag == true) {
                answer += s[i];
            }
            else if (s[i] == " " && flag == true) {
                flag = false;
                answer += '</span>' + s[i];
            }
            else if (isCharacterALetter(s[i]) == false) {
                answer += s[i];
            }
        }
    }
    else {
        answer = s;
    }

    let answer2 = "";
    flag = false;

    if (object_settings.highlite_numbers == "true") {
        for (let i = 0; i < answer.length; i++) {
            if (isCharacterNumber(answer[i]) && flag == false) {
                flag = true;
                answer2 += '<span style="color:' + object_settings.highlite_numbers_color + '">' + answer[i];
            }
            else if (isCharacterNumber(answer[i]) && flag == true) {
                answer2 += answer[i];
            }
            else if ((answer[i] == " " || isCharacterALetter(answer[i]) == true || answer[i] == "<") && flag == true) {
                flag = false;
                answer2 += '</span>' + answer[i];
            }
            else if (isCharacterNumber(answer[i]) == false) {
                answer2 += answer[i];
            }
        }
    }
    else {
        answer2 = answer;
    }

	let answer3 = "";
	flag = false;

    if (object_settings.highlite_quotes == "true") {
        for (let i = 0; i < answer2.length; i++) {
            if ((answer2[i] == "'" || answer2[i] == "`" || answer2[i] == "«" || answer2[i] == '"') && flag == false) {
                if (answer2[i - 1] != "=" && answer2[i + 1] != ">") {
                    flag = true;
                    answer3 += '<span style="color:' + object_settings.highlite_quotes_color + '">' + answer2[i];
                }
            }
            else if ((answer2[i] == "'" || answer2[i] == "`" || answer2[i] == "»" || answer2[i] == '"') && flag == true) {
                if (answer2[i - 1] != "=" && answer2[i + 1] != ">") {
                    flag = false;
                    answer3 += answer2[i] + '</span>';
                }
            }
            else {
                answer3 += answer2[i];
            }
        }
    }
    else {
        answer3 = answer2;
    }

	return answer3;
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

async function SpawnRSS(popup: any, object_settings: any) {
    SyncLog("try to spawn rss");

    let WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);

    if (WideRightPanel == null || WideRightPanel == undefined) return;

    if (popup.m_popup.document.getElementById("RSSNewBlock") == null 
    || popup.m_popup.document.getElementById("RSSNewBlock") == undefined) 
    {
        SyncLog("start spawn rss");

        const result = await get_url_data({ url: object_settings.rss_link });

        if (popup.m_popup.document.getElementById("RSSNewBlock") != null 
            && popup.m_popup.document.getElementById("RSSNewBlock") != undefined)
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

        const newsCount = Number(object_settings.newsCount);

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

            title = ChangeTitle(title, object_settings);

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
                let result = await call_back({
                    app_path: link
                });
            });

            newsBlock.id = "RSSNewBlock";

            newsBlocksList.push(newsBlock);
        });

        const repeatEvery = Number(object_settings.alternateEveryNblocks);
        const newsBlocksRange = Number(object_settings.newsBlocksRange);

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
    await print_log({ text: "OnPopupCreation"});

    if (global_object_settings == "")
    {
        SyncLog("start get_settings");

        const jsonStr = await get_settings({});
        
        SyncLog("jsonStr: " + jsonStr);

        try {
            global_object_settings = JSON.parse(jsonStr);
            SyncLog("valid json: " + global_object_settings);
        } catch (e) {
            await print_error({ text: "invalid json: " + e});
            return;
        }
    }

    if (popup.m_strName === "SP Desktop_uid0") {
        const WideRightPanel = await WaitForElement("div.WideRightPanel", popup.m_popup.document);
    
        if (WideRightPanel == null || WideRightPanel == undefined) return;

        const WideRightPanelParent = WideRightPanel.parentElement.parentElement;

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === "childList") {
                    SpawnRSS(popup, global_object_settings);
                }
            }
        });

        observer.observe(WideRightPanelParent, {
            childList: true,
            subtree: true
        });

        SpawnRSS(popup, global_object_settings);
    }
}

export default async function PluginMain() {
    console.log("[millennium-apps-buttons] frontend startup");
    await App.WaitForServicesInitialized();

    while (
        typeof g_PopupManager === 'undefined' ||
        typeof MainWindowBrowserManager === 'undefined'
    ) {
        await sleep(100);
    }

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}
