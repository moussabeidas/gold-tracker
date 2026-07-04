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
