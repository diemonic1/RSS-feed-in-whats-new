# RSS feed in whats new

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![GitHub Repo stars](https://img.shields.io/github/stars/diemonic1/RSS-feed-in-whats-new)
![GitHub issues](https://img.shields.io/github/issues/diemonic1/RSS-feed-in-whats-new)

[🇷🇺 Документация на русском](README_ru.md)

A plugin for Steam to adding RSS news to "whats new" block

<img width="1643" height="525" alt="image" src="https://github.com/user-attachments/assets/6d9a6d18-b055-4f70-b578-afd3ef7797d6" />

> [!TIP]
> The plugin settings are located inside the Steam installation folder, for example, C:\Program Files (x86)\Steam\plugins\RSS-feed-in-whats-new
>
> This is the settings.json file

In the settings file, you need to specify the address where the news will be retrieved.

Currently, the following are working:

In English:
```
http://feeds.feedburner.com/ign/games-all
```
In Russian:
```
https://rss.stopgame.ru/rss_news.xml
https://www.playground.ru/rss/news.xml
```

Other settings:

newsCount - the number of news items to display

alternateEveryNblocks - the interval between RSS news and Steam news

newsBlocksRange - the number of consecutive RSS news blocks to insert

highlite_english_letter - whether to highlight English letters within headlines (useful if the news is not in English)

highlite_numbers - whether to highlight numbers within headlines

highlite_quotes - whether to highlight text enclosed in quotation marks within headlines

You can set a different color for each character highlight. The default color is white.

# Example settings:
```
"newsCount": "4",
"alternateEveryNblocks": "1",
"newsBlocksRange": "2"
```
|📜RSS news|📜RSS news|🔷Steam news|📜RSS news|📜RSS news|🔷Steam news|
|-|-|-|-|-|-|

```
"newsCount": "4",
"alternateEveryNblocks": "0",
"newsBlocksRange": "1"
```
|📜RSS news|📜RSS news|📜RSS news|📜RSS news|🔷Steam news|🔷Steam news| 
|-|-|-|-|-|-|

```
"newsCount": "4",
"alternateEveryNblocks": "1",
"newsBlocksRange": "1"
```
|📜RSS News|🔷Steam News|📜RSS News|🔷Steam News|📜RSS News|🔷Steam News|📜RSS News|🔷Steam News|
|-|-|-|-|-|-|-|-|

```
"newsCount": "3",
"alternateEveryNblocks": "2",
"newsBlocksRange": "1"
```
|📜RSS News|🔷Steam News|🔷Steam News|📜RSS News|🔷Steam News|🔷Steam News|📜RSS News|🔷Steam News|
|-|-|-|-|-|-|-|-|

## Prerequisites
- [Millennium](https://steambrew.app/)
