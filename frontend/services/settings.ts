export interface RssSourceEntry {
  id: string;
  value: string;
  custom_value: string;
}

export interface PluginSettings {
  language: string;
  newsCount: number;
  alternateEveryNblocks: number;
  newsBlocksRange: number;
  disable_news_section: boolean;
  override_base_text: boolean;
  override_base_text_color: string;
  highlite_english_letters: boolean;
  highlite_english_letters_color: string;
  highlite_numbers: boolean;
  highlite_numbers_color: string;
  highlite_quotes: boolean;
  highlite_quotes_color: string;
  rss_link: string;
  custom_rss_link: string;
  extra_rss_sources: RssSourceEntry[];
  images_height: number;
  scroll_speed: number;
}

const STORAGE_KEY = 'RSS-feed-in-whats-new-settings';

const DEFAULT_SETTINGS: PluginSettings = {
  language: "English",
  newsCount: 10,
  alternateEveryNblocks: 1,
  newsBlocksRange: 2,
  disable_news_section: false,
  override_base_text: false,
  override_base_text_color: "#ffffff80",
  highlite_english_letters: false,
  highlite_english_letters_color: "#ffffff",
  highlite_numbers: true,
  highlite_numbers_color: "#ffffff",
  highlite_quotes: true,
  highlite_quotes_color: "#ffffff",
  rss_link: "http://feeds.feedburner.com/ign/games-all",
  custom_rss_link: "http://feeds.feedburner.com/ign/games-all",
  extra_rss_sources: [],
  images_height: 135,
  scroll_speed: 0
};

export function getSettings(): PluginSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PluginSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
