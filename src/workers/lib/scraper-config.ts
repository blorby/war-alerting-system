export interface ScraperSiteConfig {
  url: string;
  name: string;
  source: string;
  category: string; // official_statement | humanitarian | news | osint
  country: string | null;
}

export const SCRAPER_SITES: ScraperSiteConfig[] = [
  { url: 'https://www.idf.il/en/idf-media-releases/?page=1', name: 'IDF Media Releases', source: 'idf-releases', category: 'official_statement', country: 'IL' },
  { url: 'https://www.idf.il/en/mini-sites/israel-at-war/real-time-updates/', name: 'IDF Real-Time Updates', source: 'idf-realtime', category: 'official_statement', country: 'IL' },
  { url: 'https://www.idf.il/en/mini-sites/iran-israel-war-2026/iran-israel-war-2026-live-updates/', name: 'IDF Iran-Israel Updates', source: 'idf-iran', category: 'official_statement', country: 'IL' },
  { url: 'https://www.shabak.gov.il/en/terror/', name: 'Shabak Terrorism', source: 'shabak-terror', category: 'official_statement', country: 'IL' },
  { url: 'https://www.ochaopt.org/updates', name: 'OCHA oPt Updates', source: 'ocha-updates', category: 'humanitarian', country: null },
  { url: 'https://english.wafa.ps/Pages/LastNews', name: 'WAFA Last News', source: 'wafa-news', category: 'news', country: 'PS' },
  { url: 'https://www.maannews.net/news/latest', name: "Ma'an Latest", source: 'maan-latest', category: 'news', country: 'PS' },
  { url: 'https://www.inss.org.il/publication/iran-real-time/', name: 'INSS Iran Dashboard', source: 'inss-iran', category: 'osint', country: null },
  // Additional IDF / Shabak
  { url: 'https://www.idf.il/en/mini-sites/idf-press-releases-israel-at-war/', name: 'IDF War Press Releases', source: 'idf-war-press', category: 'official_statement', country: 'IL' },
  { url: 'https://www.shabak.gov.il/en/reports/', name: 'Shabak Reports', source: 'shabak-reports', category: 'official_statement', country: 'IL' },
  // Humanitarian / Palestinian context
  { url: 'https://www.ochaopt.org/publications/situation-reports', name: 'OCHA Situation Reports', source: 'ocha-sitreps', category: 'humanitarian', country: null },
  { url: 'https://english.wafa.ps/Regions/Details/2', name: 'WAFA Occupation', source: 'wafa-occupation', category: 'news', country: 'PS' },
  // Iran OSINT
  { url: 'https://www.criticalthreats.org/analysis/ctp-iran-updates', name: 'CTP Iran Updates', source: 'ctp-iran', category: 'osint', country: null },
  { url: 'https://www.inss.org.il/publication/iran-assets-map/', name: 'INSS Iran Strike Map', source: 'inss-strike-map', category: 'osint', country: null },
  { url: 'https://www.inss.org.il/publication/lions-roar-data/', name: 'INSS Iran Campaign', source: 'inss-campaign', category: 'osint', country: null },
];

export const INTERVAL_MS = 15 * 60_000;
