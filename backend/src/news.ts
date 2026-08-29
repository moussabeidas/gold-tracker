// Curated gold-market news, fetched server-side and cached. The app's
// on-device fetches to Yahoo/Google proved unreliable (agent filtering,
// carrier quirks); the server does the fetching once for everyone.

export interface NewsStory {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: number;
  thumbnailUrl: string | null;
}

const QUERIES = [
  "gold price",
  "gold bullion",
  "XAU USD gold",
  "precious metals prices",
];

const RELEVANT =
  /\bgold\b|\bxau\b|bullion|precious metal|\bsilver\b|platinum|palladium|troy ounce/i;
const MARKET_CONTEXT =
  /price|rally|record|high|low|surge|soar|slip|fall|drop|climb|rise|gain|ounce|futures|spot|market|demand|forecast|outlook|fed|inflation|dollar|central bank|etf|invest|buy|sell|haven|bull|bear|reserve|mine|mining|\$\d/i;
const NOISE =
  /gold medal|golden state|gold cup|gold glove|golden globe|gold coast|golden retriever|olympic|world cup|golden age|golden hour|golden ticket|golden gate|bitcoin|crypto|ethereum|digital gold|golden visa|goldilocks/i;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const TTL_MS = 10 * 60_000;
let cache: { at: number; articles: NewsStory[] } | null = null;

function isOnTopic(title: string): boolean {
  return RELEVANT.test(title) && MARKET_CONTEXT.test(title) && !NOISE.test(title);
}

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA, Accept: "*/*" },
      redirect: "follow",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fromYahoo(query: string, count: number): Promise<NewsStory[]> {
  for (const base of [
    "https://query1.finance.yahoo.com/v1/finance/search",
    "https://query2.finance.yahoo.com/v1/finance/search",
  ]) {
    const res = await fetchWithTimeout(
      `${base}?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0`
    );
    if (!res) continue;
    try {
      const json: any = await res.json();
      const items: any[] = Array.isArray(json?.news) ? json.news : [];
      const stories: NewsStory[] = [];
      for (const item of items) {
        if (typeof item?.title !== "string" || typeof item?.link !== "string")
          continue;
        const resolutions: any[] = item?.thumbnail?.resolutions ?? [];
        const usable = resolutions
          .filter((r) => typeof r?.url === "string" && (r?.width ?? 0) >= 140)
          .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
        stories.push({
          id: String(item.uuid ?? item.link),
          title: item.title,
          publisher:
            typeof item.publisher === "string" ? item.publisher : "News",
          url: item.link,
          publishedAt:
            typeof item.providerPublishTime === "number"
              ? item.providerPublishTime * 1000
              : Date.now(),
          thumbnailUrl: usable[0]?.url ?? resolutions[0]?.url ?? null,
        });
      }
      if (stories.length) return stories;
    } catch {}
  }
  return [];
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

async function fromGoogleRss(query: string, count: number): Promise<NewsStory[]> {
  const res = await fetchWithTimeout(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  );
  if (!res) return [];
  const xml = await res.text();
  const stories: NewsStory[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && stories.length < count) {
    const block = m[1];
    const tag = (name: string) => {
      const t = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
      return t ? decodeXml(t[1]) : "";
    };
    const link = tag("link");
    let title = tag("title");
    const publisher = tag("source") || "News";
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(publisher.length + 3));
    }
    if (!title || !link.startsWith("http")) continue;
    const pub = Date.parse(tag("pubDate"));
    stories.push({
      id: link,
      title,
      publisher,
      url: link,
      publishedAt: isFinite(pub) ? pub : Date.now(),
      thumbnailUrl: null,
    });
  }
  return stories;
}

/** Merged, deduped, filtered, freshest-first gold-market stories. */
export async function getCuratedNews(): Promise<NewsStory[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.articles;

  const batches = await Promise.all(
    QUERIES.map(async (q) => {
      const yahoo = await fromYahoo(q, 10);
      if (yahoo.length) return yahoo;
      return fromGoogleRss(q, 10);
    })
  );

  const seen = new Set<string>();
  const merged: NewsStory[] = [];
  for (const batch of batches) {
    for (const story of batch) {
      const key = story.title.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(story);
    }
  }

  const articles = merged
    .filter((s) => isOnTopic(s.title))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 8);

  // Cache even empty results briefly so a broken upstream doesn't get
  // hammered; the shorter TTL retries sooner.
  cache = {
    at: articles.length ? Date.now() : Date.now() - TTL_MS + 60_000,
    articles,
  };
  return articles;
}
