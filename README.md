# RSS feed in whats new

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![GitHub Repo stars](https://img.shields.io/github/stars/diemonic1/RSS-feed-in-whats-new)
![GitHub issues](https://img.shields.io/github/issues/diemonic1/RSS-feed-in-whats-new)

A plugin for Steam to adding RSS news to "whats new" block

> ### 🚫 Don't want the news at all?
> The plugin can **completely disable the "What's New" section** in the Steam Library.
> Turn on **"Completely disable the news section"** at the top of the plugin settings - the whole
> block is removed from the library, and the plugin stops fetching and displaying any news.

<img alt="image" src="https://github.com/user-attachments/assets/6d9a6d18-b055-4f70-b578-afd3ef7797d6" />

Settings:

disable_news_section - completely disables the "What's New" section in the Steam Library (off by default)

rss_link - you can independently specify any news source of your choice

Additional RSS sources - add as many extra feeds as you like. News from all sources is merged and
sorted by publication date, duplicates are ignored, and every headline is labelled with its source

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

| 📜RSS news | 📜RSS news | 🔷Steam news | 📜RSS news | 📜RSS news | 🔷Steam news |
| ---------- | ---------- | ------------ | ---------- | ---------- | ------------ |

```
"newsCount": "4",
"alternateEveryNblocks": "0",
"newsBlocksRange": "1"
```

| 📜RSS news | 📜RSS news | 📜RSS news | 📜RSS news | 🔷Steam news | 🔷Steam news |
| ---------- | ---------- | ---------- | ---------- | ------------ | ------------ |

```
"newsCount": "4",
"alternateEveryNblocks": "1",
"newsBlocksRange": "1"
```

| 📜RSS News | 🔷Steam News | 📜RSS News | 🔷Steam News | 📜RSS News | 🔷Steam News | 📜RSS News | 🔷Steam News |
| ---------- | ------------ | ---------- | ------------ | ---------- | ------------ | ---------- | ------------ |

```
"newsCount": "3",
"alternateEveryNblocks": "2",
"newsBlocksRange": "1"
```

| 📜RSS News | 🔷Steam News | 🔷Steam News | 📜RSS News | 🔷Steam News | 🔷Steam News | 📜RSS News | 🔷Steam News |
| ---------- | ------------ | ------------ | ---------- | ------------ | ------------ | ---------- | ------------ |

## Prerequisites

- [Millennium](https://steambrew.app/)

## Screenshots

<img alt="image" src="https://github.com/user-attachments/assets/641d4861-7322-4f78-a45e-2fea407c663a" />

<img alt="image" src="https://github.com/user-attachments/assets/460e7377-485d-4a73-99b5-3bca62c820ec" />

<img alt="image" src="https://github.com/user-attachments/assets/bc282155-39a0-4f0a-a6bf-32db1b9169c8" />
