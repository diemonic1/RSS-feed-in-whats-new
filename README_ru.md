# RSS feed in whats new

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![GitHub Repo stars](https://img.shields.io/github/stars/diemonic1/RSS-feed-in-whats-new)
![GitHub issues](https://img.shields.io/github/issues/diemonic1/RSS-feed-in-whats-new)

Плагин для Steam для добавления RSS-новостей в блок «Что нового»

<img width="1643" height="525" alt="image" src="https://github.com/user-attachments/assets/6d9a6d18-b055-4f70-b578-afd3ef7797d6" />

> [!TIP]
> Настройки плагина лежат внутри папки установки Steam, например C:\Program Files (x86)\Steam\plugins\RSS-feed-in-whats-new
>
> Это файл settings.json

В файле настроек нужно указать адрес, откуда будут браться новости

На данный момент точно работают:

На английском языке:
```
http://feeds.feedburner.com/ign/games-all
```
На русском языке:
```
https://rss.stopgame.ru/rss_news.xml
https://www.playground.ru/rss/news.xml
```

Другие настройки:

newsCount - количество новостей, которое будет выводится

alternateEveryNblocks - через сколько будут чередоваться RSS новости и новости из Steam

newsBlocksRange - сколько новостных RSS блоков будут вставляться подряд

# Примеры настроек:
```
"newsCount": "4",
"alternateEveryNblocks": "1",
"newsBlocksRange": "2"
```
|📜RSS новость|📜RSS новость|🔷Steam новость|📜RSS новость|📜RSS новость|🔷Steam новость|
|-|-|-|-|-|-|

```
"newsCount": "4",
"alternateEveryNblocks": "0",
"newsBlocksRange": "1"
```
|📜RSS новость|📜RSS новость|📜RSS новость|📜RSS новость|🔷Steam новость|🔷Steam новость|
|-|-|-|-|-|-|

```
"newsCount": "4",
"alternateEveryNblocks": "1",
"newsBlocksRange": "1"
```
|📜RSS новость|🔷Steam новость|📜RSS новость|🔷Steam новость|📜RSS новость|🔷Steam новость|📜RSS новость|🔷Steam новость|
|-|-|-|-|-|-|-|-|

```
"newsCount": "3",
"alternateEveryNblocks": "2",
"newsBlocksRange": "1"
```
|📜RSS новость|🔷Steam новость|🔷Steam новость|📜RSS новость|🔷Steam новость|🔷Steam новость|📜RSS новость|🔷Steam новость|
|-|-|-|-|-|-|-|-|

## Необходимые компоненты
- [Millennium](https://steambrew.app/)
