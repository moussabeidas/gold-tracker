import { useState, useEffect, useRef, useCallback } from "react";

import { useGoldPrice, BASELINE_PRICE } from "@/context/GoldPriceContext";
import { fetchSeries, type Candle } from "@/lib/marketData";

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export interface PricePoint {
  time: number;
  price: number;
}

// Spot symbol first; COMEX futures as fallback — GC=F has decades of
// complete history and tracks spot within a few dollars.
const GOLD_SYMBOLS = ["XAUUSD=X", "GC=F"];

// Yahoo chart parameters per range
const RANGE_QUERY: Record<TimeRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "1m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "60m" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
};

// Real-series cache: intraday goes stale fast, daily bars don't.
const CACHE_TTL_MS: Record<TimeRange, number> = {
  "1D": 60_000,
  "1W": 5 * 60_000,
  "1M": 15 * 60_000,
  "3M": 60 * 60_000,
  "6M": 60 * 60_000,
  "1Y": 60 * 60_000,
  "5Y": 6 * 60 * 60_000,
};

// A series must be reasonably complete before we trust it over the fallback
const MIN_POINTS: Record<TimeRange, number> = {
  "1D": 30,
  "1W": 40,
  "1M": 60,
  "3M": 40,
  "6M": 80,
  "1Y": 160,
  "5Y": 150,
};

const seriesCache = new Map<TimeRange, { at: number; data: PricePoint[] }>();
let week52Cache: { at: number; high: number; low: number } | null = null;

// ---------------------------------------------------------------------------
// Synthetic fallback (offline / API failure only). Historically grounded
// start prices expressed against BASELINE_PRICE; rescaled to the live level.
// ---------------------------------------------------------------------------

const RANGE_START: Record<TimeRange, number> = {
  "1D": 3118.5,
  "1W": 3054.2,
  "1M": 2971.8,
  "3M": 2762.3,
  "6M": 2488.6,
  "1Y": 2164.4,
  "5Y": 1682.0,
};

const RANGE_VOL: Record<TimeRange, number> = {
  "1D": 0.00038,
  "1W": 0.0048,
  "1M": 0.0082,
  "3M": 0.0095,
  "6M": 0.0115,
  "1Y": 0.0135,
  "5Y": 0.0160,
};

const RANGE_POINTS: Record<TimeRange, number> = {
  "1D": 390,
  "1W": 168,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 252,
  "5Y": 260,
};

const RANGE_INTERVAL_MS: Record<TimeRange, number> = {
  "1D": 60 * 1000,
  "1W": 60 * 60 * 1000,
  "1M": 24 * 60 * 60 * 1000,
  "3M": 24 * 60 * 60 * 1000,
  "6M": 24 * 60 * 60 * 1000,
  "1Y": 24 * 60 * 60 * 1000,
  "5Y": 7 * 24 * 60 * 60 * 1000,
};

function seededRng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateData(range: TimeRange, endPrice: number): PricePoint[] {
  const now = Date.now();
  const n = RANGE_POINTS[range];
  const intervalMs = RANGE_INTERVAL_MS[range];
  const vol = RANGE_VOL[range];
  const scale = endPrice / BASELINE_PRICE;
  const startPrice = RANGE_START[range] * scale;

  const seed = range.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7) * 31, 1337);
  const rng = seededRng(seed);

  const baseDrift = (Math.log(endPrice) - Math.log(startPrice)) / n;
  const logPrices: number[] = [Math.log(startPrice)];

  for (let i = 1; i < n; i++) {
    const prev = logPrices[i - 1];
    const remaining = n - i;
    const bridgePull =
      remaining < n * 0.15
        ? ((Math.log(endPrice) - prev) / Math.max(remaining, 1)) * 0.5
        : 0;
    const volMultiplier = rng() < 0.03 ? 2.0 + rng() * 2.0 : 1.0;
    const step = baseDrift + bridgePull + vol * volMultiplier * gaussian(rng);
    logPrices.push(prev + step);
  }

  let prices = logPrices.map((lp) => Math.round(Math.exp(lp) * 100) / 100);
  prices = prices.map((p) =>
    Math.min(endPrice * 1.6, Math.max(endPrice * 0.3, p))
  );
  prices[prices.length - 1] = endPrice;

  return prices.map((price, i) => ({
    time: now - (n - i) * intervalMs,
    price,
  }));
}

// ---------------------------------------------------------------------------

async function loadRealSeries(range: TimeRange): Promise<PricePoint[] | null> {
  const cached = seriesCache.get(range);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS[range]) {
    return cached.data;
  }
  const q = RANGE_QUERY[range];

  let best: PricePoint[] | null = null;
  for (const symbol of GOLD_SYMBOLS) {
    const candles = await fetchSeries(symbol, q.range, q.interval, 500, 20000);
    if (!candles) continue;
    if (!best || candles.length > best.length) best = candles;
    if (candles.length >= MIN_POINTS[range]) break; // complete enough
  }

  if (!best) return cached?.data ?? null;
  seriesCache.set(range, { at: Date.now(), data: best });
  return best;
}

async function loadWeek52(): Promise<{ high: number; low: number } | null> {
  if (week52Cache && Date.now() - week52Cache.at < 60 * 60_000) {
    return week52Cache;
  }
  let candles: Candle[] | null = null;
  for (const symbol of GOLD_SYMBOLS) {
    candles = await fetchSeries(symbol, "1y", "1d", 500, 20000);
    if (candles && candles.length >= 160) break;
  }
  if (!candles || !candles.length) return week52Cache;
  const prices = candles.map((c: Candle) => c.price);
  week52Cache = {
    at: Date.now(),
    high: Math.max(...prices),
    low: Math.min(...prices),
  };
  return week52Cache;
}

export function useGoldData(range: TimeRange) {
  const { spotPrice, anchorPrice, isLive } = useGoldPrice();
  const [data, setData] = useState<PricePoint[]>([]);
  const [isRealHistory, setIsRealHistory] = useState(false);
  const [week52, setWeek52] = useState<{ high: number; low: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const generatedAnchor = useRef<number | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (anchor: number) => {
      const id = ++requestId.current;
      setIsLoading(true);
      generatedAnchor.current = anchor;

      const real = await loadRealSeries(range);
      if (id !== requestId.current) return; // superseded by a newer request

      if (real && real.length) {
        setData(real);
        setIsRealHistory(true);
      } else {
        setData(generateData(range, anchor));
        setIsRealHistory(false);
      }
      setIsLoading(false);
    },
    [range]
  );

  useEffect(() => {
    load(anchorPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const refresh = useCallback(async () => {
    seriesCache.delete(range);
    await load(anchorPrice);
  }, [range, load, anchorPrice]);

  // If we're on synthetic data and the live anchor moves meaningfully
  // (e.g. first real fetch replacing the baseline), regenerate.
  useEffect(() => {
    const prev = generatedAnchor.current;
    if (
      !isRealHistory &&
      prev !== null &&
      Math.abs(anchorPrice - prev) / prev > 0.003
    ) {
      load(anchorPrice);
    }
  }, [anchorPrice, isRealHistory, load]);

  // 52-week stats from real daily candles
  useEffect(() => {
    let cancelled = false;
    loadWeek52().then((w) => {
      if (!cancelled && w) setWeek52({ high: w.high, low: w.low });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync the last chart point with the confirmed price on each real fetch
  // (every 30s) — not on every cosmetic 3s tick, which would rebuild the
  // series and its SVG path constantly and stutter scrolling.
  useEffect(() => {
    setData((d) => {
      if (!d.length) return d;
      const last = d[d.length - 1];
      if (Math.abs(last.price - anchorPrice) < 0.01) return d;
      const updated = [...d];
      updated[updated.length - 1] = { time: Date.now(), price: anchorPrice };
      return updated;
    });
  }, [anchorPrice]);

  const startPrice = data[0]?.price ?? spotPrice;
  const change = spotPrice - startPrice;
  const changePct = startPrice ? (change / startPrice) * 100 : 0;
  const isPositive = change >= 0;

  return {
    data,
    currentPrice: spotPrice,
    change,
    changePct,
    isPositive,
    isLoading,
    isLive,
    isRealHistory,
    week52,
    refresh,
    scale: anchorPrice / BASELINE_PRICE,
  };
}
