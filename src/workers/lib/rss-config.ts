export interface RssFeedConfig {
  url: string;
  name: string;
  source: string;
  category: string;
  language: string;
}

export const RSS_FEEDS: RssFeedConfig[] = [
  // Israeli news
  { url: 'https://www.timesofisrael.com/feed/', name: 'Times of Israel', source: 'toi', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/rssfeedsheadlines.aspx', name: 'JPost Headlines', source: 'jpost-headlines', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/rssfeedsisraelnews.aspx', name: 'JPost Israel News', source: 'jpost-israel', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/rssfeedsgaza.aspx', name: 'JPost Gaza', source: 'jpost-gaza', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/rssfeedsmiddleeastnews.aspx', name: 'JPost Middle East', source: 'jpost-mideast', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/rssfeedsarabisraeliconflict.aspx', name: 'JPost Arab-Israeli Conflict', source: 'jpost-conflict', category: 'israeli_news', language: 'en' },
  { url: 'https://rss.jpost.com/rss/israel-hamas-war', name: 'JPost Israel-Hamas War', source: 'jpost-hamas-war', category: 'israeli_news', language: 'en' },
  { url: 'https://www.israelnationalnews.com/Rss.aspx', name: 'Israel National News', source: 'inn', category: 'israeli_news', language: 'en' },
  { url: 'https://www.ynet.co.il/Integration/StoryRss3254.xml', name: 'Ynet Breaking', source: 'ynet-breaking', category: 'israeli_news', language: 'he' },
  { url: 'https://www.ynet.co.il/Integration/StoryRss3082.xml', name: 'Ynet All News', source: 'ynet-all', category: 'israeli_news', language: 'he' },
  // International
  { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', name: 'BBC Middle East', source: 'bbc-mideast', category: 'international', language: 'en' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml?region=middle-east', name: 'Al Jazeera Middle East', source: 'aljazeera-mideast', category: 'international', language: 'en' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera Global', source: 'aljazeera-global', category: 'international', language: 'en' },
  // Iran / Military
  { url: 'https://www.centcom.mil/RSS/', name: 'CENTCOM', source: 'centcom', category: 'iran_military', language: 'en' },
  { url: 'https://www.act.nato.int/article-rss-xml/', name: 'NATO ACT', source: 'nato-act', category: 'iran_military', language: 'en' },
];
