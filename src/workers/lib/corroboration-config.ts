export const SOURCE_CATEGORIES: Record<string, string> = {
  // Official (1 source sufficient)
  'oref-current': 'official',
  'oref-history': 'official',
  'telegram-hfc-alerts': 'official',
  'telegram-hfc-instructions': 'official',
  'idf-releases': 'official',
  'idf-realtime': 'official',
  'idf-iran': 'official',
  'shabak-terror': 'official',
  // News
  'toi': 'news',
  'jpost-headlines': 'news',
  'jpost-israel': 'news',
  'jpost-gaza': 'news',
  'jpost-mideast': 'news',
  'jpost-conflict': 'news',
  'jpost-hamas-war': 'news',
  'inn': 'news',
  'ynet-breaking': 'news',
  'ynet-all': 'news',
  'bbc-mideast': 'news',
  'aljazeera-mideast': 'news',
  'aljazeera-global': 'news',
  'centcom': 'news',
  'nato-act': 'news',
  'gdelt': 'news',
  // Humanitarian
  'ocha-updates': 'humanitarian',
  'wafa-news': 'humanitarian',
  'maan-latest': 'humanitarian',
  // OSINT
  'inss-iran': 'osint',
  'adsb-lol': 'osint',
  'opensky': 'osint',
  // Social
  'telegram-idf': 'social',
};

export const INTERVAL_MS = 2 * 60_000; // 2 minutes
export const TIME_WINDOW_MS = 30 * 60_000; // 30 minute matching window
export const LOOKBACK_MS = 2 * 60 * 60_000; // scan events from last 2 hours
