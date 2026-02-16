export interface PluginSettings {
  newsCount: number;
  alternateEveryNblocks: number;
  newsBlocksRange: number;
  highlite_english_letters: boolean;
  highlite_english_letters_color: string;
  highlite_numbers: boolean;
  highlite_numbers_color: string;
  highlite_quotes: boolean;
  highlite_quotes_color: string;
  rss_link: string;
  custom_rss_link: string;
  images_height: number;
}

const STORAGE_KEY = 'RSS-feed-in-whats-new-settings';

const DEFAULT_SETTINGS: PluginSettings = {
  newsCount: 10,
  alternateEveryNblocks: 1,
  newsBlocksRange: 2,
  highlite_english_letters: false,
  highlite_english_letters_color: "#ffffff",
  highlite_numbers: true,
  highlite_numbers_color: "#ffffff",
  highlite_quotes: true,
  highlite_quotes_color: "#ffffff",
  rss_link: "http://feeds.feedburner.com/ign/games-all",
  custom_rss_link: "http://feeds.feedburner.com/ign/games-all",
  images_height: 135
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
