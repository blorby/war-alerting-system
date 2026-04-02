export interface ScrapedItem {
  title: string;
  url: string;
  date: Date | null;
  snippet: string | null;
}

/**
 * Dispatches HTML parsing to the site-specific parser based on source key.
 * Uses regex-based HTML parsing (no DOM library).
 */
export function parseSite(html: string, source: string, baseUrl: string): ScrapedItem[] {
  try {
    switch (source) {
      case 'idf-releases':
      case 'idf-realtime':
      case 'idf-iran':
        return parseIdf(html, baseUrl);
      case 'shabak-terror':
        return parseShabak(html, baseUrl);
      case 'ocha-updates':
        return parseOcha(html, baseUrl);
      case 'wafa-news':
        return parseWafa(html, baseUrl);
      case 'maan-latest':
        return parseMaan(html, baseUrl);
      case 'inss-iran':
        return parseInss(html, baseUrl);
      default:
        console.warn(`[scraper-parser] unknown source: ${source}`);
        return [];
    }
  } catch (err) {
    console.warn(
      `[scraper-parser] parse error for source=${source}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return baseUrl;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  // Strip trailing slash from base for clean join
  const base = baseUrl.replace(/\/$/, '');
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${base}${path}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    // Intentionally do not decode &lt; and &gt; to avoid reintroducing HTML tag delimiters.
    // Also remove any literal `<` or `>` that might appear after decoding entities to avoid
    // reintroducing HTML tag delimiters via multi-step sanitization.
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWafChallengePage(html: string): boolean {
  return (
    html.includes('_Incapsula_Resource') ||
    html.includes('cf_chl_opt') ||
    html.includes('challenge-platform') ||
    (html.includes('Just a moment') && html.includes('Enable JavaScript'))
  );
}

// --- IDF (idf.il) ---
// IDF sites are behind Incapsula WAF and typically return a JS challenge page
// when fetched with a plain HTTP client. If real HTML is returned, articles
// appear as cards with links in <a> tags containing /en/ paths, with h2/h3 titles.
function parseIdf(html: string, baseUrl: string): ScrapedItem[] {
  if (isWafChallengePage(html)) {
    console.warn(`[scraper-parser] IDF site returned WAF challenge page, skipping`);
    return [];
  }

  const items: ScrapedItem[] = [];
  // Generic pattern: look for article-like blocks with links containing /en/ paths
  // IDF uses card components with <a> wrapping or containing <h2>/<h3> headlines
  const linkPattern = /<a[^>]+href="(\/en\/[^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    if (seen.has(href)) continue;
    seen.add(href);

    const block = match[0];
    // Try to extract a title from h2, h3, h4, or the link text itself
    const titleMatch =
      block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i) ||
      block.match(/>([^<]{10,})</);
    if (!titleMatch) continue;

    const title = stripHtml(titleMatch[1]);
    if (!title || title.length < 5) continue;

    // Try to find a date near the link
    const blockStart = Math.max(0, (match.index ?? 0) - 500);
    const blockEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 500);
    const context = html.slice(blockStart, blockEnd);
    const date = extractDate(context);

    items.push({
      title,
      url: resolveUrl(href, baseUrl),
      date,
      snippet: null,
    });
  }

  return items;
}

// --- Shabak (shabak.gov.il) ---
// Behind Cloudflare challenge. If real HTML comes through, look for article cards.
function parseShabak(html: string, baseUrl: string): ScrapedItem[] {
  if (isWafChallengePage(html)) {
    console.warn(`[scraper-parser] Shabak site returned WAF/CF challenge page, skipping`);
    return [];
  }

  const items: ScrapedItem[] = [];
  // Shabak terror page typically lists incidents with links
  const cardPattern = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = cardPattern.exec(html)) !== null) {
    const href = match[1];
    if (seen.has(href) || href === '#' || href === '/') continue;
    if (!href.includes('/en/') && !href.includes('terror')) continue;
    seen.add(href);

    const block = match[0];
    const titleMatch =
      block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i) ||
      block.match(/>([^<]{10,})</);
    if (!titleMatch) continue;

    const title = stripHtml(titleMatch[1]);
    if (!title || title.length < 5) continue;

    const blockStart = Math.max(0, (match.index ?? 0) - 500);
    const blockEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 500);
    const context = html.slice(blockStart, blockEnd);
    const date = extractDate(context);

    items.push({
      title,
      url: resolveUrl(href, baseUrl),
      date,
      snippet: null,
    });
  }

  return items;
}

// --- OCHA oPt (ochaopt.org) ---
// Drupal site with real server-rendered HTML.
// Structure: div.dexp-grid-item > div.node--type-ocha-opt-articles
//   Date in: div.grey > span (e.g. "27 Mar 2026")
//   Title in: div.field--name-node-title > h3 > a
//   Link in the same <a> tag
function parseOcha(html: string, baseUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  // Match each article node block
  const nodePattern = /class="node\s[^"]*node--type-ocha-opt-articles[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let nodeMatch: RegExpExecArray | null;

  while ((nodeMatch = nodePattern.exec(html)) !== null) {
    const block = nodeMatch[0];

    // Extract date from div.grey > span
    const dateMatch = block.match(/<div\s+class="grey">\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>\s*<\/div>/i);
    let date: Date | null = null;
    if (dateMatch) {
      const dateStr = stripHtml(dateMatch[1]);
      date = parseFlexibleDate(dateStr);
    }

    // Extract title and URL from field--name-node-title > h3 > a
    const titleMatch = block.match(
      /field--name-node-title[\s\S]*?<h3>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i,
    );
    if (!titleMatch) continue;

    const href = titleMatch[1];
    const title = stripHtml(titleMatch[2]);
    if (!title) continue;

    items.push({
      title,
      url: resolveUrl(href, 'https://www.ochaopt.org'),
      date,
      snippet: null,
    });
  }

  return items;
}

// --- WAFA (english.wafa.ps) ---
// Server-rendered HTML.
// Structure: div.post.post-largecat1 > div.post-wrap > div.content
//   Date in: span.meta-item.date (e.g. "01/April/2026 02:50 PM")
//   Title in: h4.title > a
function parseWafa(html: string, baseUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  // Match each post block
  const postPattern = /<div\s+class="post\s+post-largecat1[^"]*"[\s\S]*?<!-- Post End -->/gi;
  let postMatch: RegExpExecArray | null;

  while ((postMatch = postPattern.exec(html)) !== null) {
    const block = postMatch[0];

    // Extract date
    const dateMatch = block.match(/<span\s+class="meta-item\s+date">([\s\S]*?)<\/span>/i);
    let date: Date | null = null;
    if (dateMatch) {
      const dateStr = stripHtml(dateMatch[1]);
      date = parseWafaDate(dateStr);
    }

    // Extract title and URL
    const titleMatch = block.match(/<h4\s+class="title"><a\s+href="([^"]+)">([\s\S]*?)<\/a><\/h4>/i);
    if (!titleMatch) continue;

    const href = titleMatch[1];
    const title = stripHtml(titleMatch[2]);
    if (!title) continue;

    items.push({
      title,
      url: resolveUrl(href, 'https://english.wafa.ps'),
      date,
      snippet: null,
    });
  }

  return items;
}

// --- Ma'an News (maannews.net) ---
// Behind Cloudflare challenge. If real HTML comes through, it is an Arabic site
// with article cards. The English version may or may not be available.
function parseMaan(html: string, baseUrl: string): ScrapedItem[] {
  if (isWafChallengePage(html)) {
    console.warn(`[scraper-parser] Ma'an site returned CF challenge page, skipping`);
    return [];
  }

  const items: ScrapedItem[] = [];
  // Ma'an typically uses article cards with h2/h3 headlines and links
  const articlePattern = /<article[^>]*>[\s\S]*?<\/article>/gi;
  let articleMatch: RegExpExecArray | null;

  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const block = articleMatch[0];
    const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const titleMatch =
      block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i) ||
      block.match(/<a[^>]*>([^<]{10,})<\/a>/i);
    if (!titleMatch) continue;

    const title = stripHtml(titleMatch[1]);
    if (!title || title.length < 5) continue;

    const date = extractDate(block);
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : null;

    items.push({
      title,
      url: resolveUrl(href, baseUrl),
      date,
      snippet: snippet && snippet.length > 10 ? snippet : null,
    });
  }

  // Fallback: if no <article> tags, try generic link-based extraction
  if (items.length === 0) {
    const linkPattern = /<a[^>]+href="(\/[^"]*news[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1];
      if (seen.has(href)) continue;
      seen.add(href);

      const title = stripHtml(match[2]);
      if (!title || title.length < 10) continue;

      items.push({
        title,
        url: resolveUrl(href, baseUrl),
        date: null,
        snippet: null,
      });
    }
  }

  return items;
}

// --- INSS Iran Dashboard (inss.org.il) ---
// This is an Elementor-based single dashboard page, not an article listing.
// It contains data visualizations and embedded content, not a list of articles.
// We try to extract any linked publication references if present.
function parseInss(html: string, baseUrl: string): ScrapedItem[] {
  if (isWafChallengePage(html)) {
    console.warn(`[scraper-parser] INSS site returned WAF challenge page, skipping`);
    return [];
  }

  const items: ScrapedItem[] = [];
  // Look for publication links within Elementor content
  const linkPattern = /<a[^>]+href="(https?:\/\/www\.inss\.org\.il\/publication\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    // Skip the page's own canonical URL
    if (href.includes('iran-real-time')) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const title = stripHtml(match[2]);
    if (!title || title.length < 5) continue;

    items.push({
      title,
      url: href,
      date: null,
      snippet: null,
    });
  }

  return items;
}

// --- Date parsing helpers ---

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parses dates like "27 Mar 2026" or "27 March 2026"
 */
function parseFlexibleDate(dateStr: string): Date | null {
  // "DD Mon YYYY" or "DD Month YYYY"
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // ISO-like dates
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Parses WAFA date format: "01/April/2026 02:50 PM"
 */
function parseWafaDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{1,2})\/([A-Za-z]+)\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  let hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const ampm = match[6].toUpperCase();

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return null;

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  return new Date(Date.UTC(year, month, day, hour, minute));
}

/**
 * Tries to extract any date from a block of HTML text.
 */
function extractDate(block: string): Date | null {
  // Try <time> element
  const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/i);
  if (timeMatch) {
    const d = new Date(timeMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // Try common date patterns in text
  const text = stripHtml(block);

  // "DD Month YYYY" or "DD Mon YYYY"
  const flexDate = parseFlexibleDate(text);
  if (flexDate) return flexDate;

  // ISO date
  const isoMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}
