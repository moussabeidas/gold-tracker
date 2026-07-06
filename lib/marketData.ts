// Free, keyless market data from Yahoo Finance's public chart API.
// Used for real price history (all chart ranges) and spot quotes for
// silver / platinum / palladium. Every call is defensive: callers get
// null on any failure and fall back to simulated data.

export interface Candle {
  time: number; // ms epoch
  price: number;
}

export interface Quote {
  price: number;
  prevClose: number;
  changePct: number;
}

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
// Both public Yahoo hosts serve the search endpoint; try them in order in
// case one throttles the app's requests.
const SEARCH_BASES = [
  "https://query1.finance.yahoo.com/v1/finance/search",
  "https://query2.finance.yahoo.com/v1/finance/search",
];

export interface NewsStory {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: number; // ms epoch
  thumbnailUrl: string | null;
}

function plausible(v: unknown, lo: number, hi: number): v is number {
  return typeof v === "number" && isFinite(v) && v > lo && v < hi;
}

async function fetchChart(
  symbol: string,
  range: string,
  interval: string
): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSeries(
  symbol: string,
  range: string,
  interval: string,
  priceLo = 100,
  priceHi = 100000
): Promise<Candle[] | null> {
  const result = await fetchChart(symbol, range, interval);
  const timestamps: unknown[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length || timestamps.length !== closes.length) return null;

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (typeof t === "number" && plausible(c, priceLo, priceHi)) {
      candles.push({ time: t * 1000, price: Math.round(c * 100) / 100 });
    }
  }
  // Require a reasonably complete series before trusting it
  return candles.length >= Math.min(10, timestamps.length) ? candles : null;
}

const dateCache = new Map<string, number>();

/**
 * Gold's closing price (USD/oz) on a given calendar date, from real daily
 * candles. Uses the nearest trading day at or before the date (markets are
 * closed on weekends/holidays). Null if unavailable.
 */
export async function fetchGoldPriceOnDate(
  symbol: string,
  dateMs: number
): Promise<number | null> {
  const dayKey = new Date(dateMs).toISOString().slice(0, 10);
  const cached = dateCache.get(dayKey);
  if (cached !== undefined) return cached;

  const primary = await fetchPriceOnDateFor(symbol, dateMs);
  if (primary !== null) {
    dateCache.set(dayKey, primary);
    return primary;
  }
  // COMEX futures fallback — deep history, tracks spot within dollars
  const fallback = await fetchPriceOnDateFor("GC=F", dateMs);
  if (fallback !== null) dateCache.set(dayKey, fallback);
  return fallback;
}

async function fetchPriceOnDateFor(
  symbol: string,
  dateMs: number
): Promise<number | null> {

  // Window of 10 days before → 1 day after covers weekends and holidays
  const period1 = Math.floor(dateMs / 1000) - 10 * 86400;
  const period2 = Math.floor(dateMs / 1000) + 86400;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: unknown[] = result?.timestamp ?? [];
    const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];

    // Latest candle at or before end of the requested date
    const cutoff = dateMs / 1000 + 86400;
    let best: number | null = null;
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const c = closes[i];
      if (typeof t === "number" && t < cutoff && plausible(c, 100, 100000)) {
        best = Math.round(c * 100) / 100;
      }
    }
    return best;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNews(
  query: string,
  count = 8
): Promise<NewsStory[] | null> {
  for (const base of SEARCH_BASES) {
    const stories = await fetchNewsFrom(base, query, count);
    if (stories) return stories;
  }
  return null;
}

async function fetchNewsFrom(
  base: string,
  query: string,
  count: number
): Promise<NewsStory[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${base}?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items: any[] = Array.isArray(json?.news) ? json.news : [];

    const stories: NewsStory[] = [];
    for (const item of items) {
      if (typeof item?.title !== "string" || typeof item?.link !== "string") continue;
      // Pick the smallest thumbnail that's still crisp at 72pt (≥140px)
      const resolutions: any[] = item?.thumbnail?.resolutions ?? [];
      const usable = resolutions
        .filter((r) => typeof r?.url === "string" && (r?.width ?? 0) >= 140)
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
      stories.push({
        id: String(item.uuid ?? item.link),
        title: item.title,
        publisher: typeof item.publisher === "string" ? item.publisher : "News",
        url: item.link,
        publishedAt:
          typeof item.providerPublishTime === "number"
            ? item.providerPublishTime * 1000
            : Date.now(),
        thumbnailUrl: usable[0]?.url ?? resolutions[0]?.url ?? null,
      });
    }
    return stories.length ? stories : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchQuote(
  symbol: string,
  priceLo = 1,
  priceHi = 100000
): Promise<Quote | null> {
  const result = await fetchChart(symbol, "5d", "1d");
  const meta = result?.meta;
  const price = meta?.regularMarketPrice;
  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
  if (!plausible(price, priceLo, priceHi) || !plausible(prevClose, priceLo, priceHi)) {
    return null;
  }
  return {
    price: Math.round(price * 100) / 100,
    prevClose,
    changePct: ((price - prevClose) / prevClose) * 100,
  };
}
