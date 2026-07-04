import { useState, useEffect, useRef, useCallback } from "react";

import { useGoldPrice, BASELINE_PRICE } from "@/context/GoldPriceContext";

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export interface PricePoint {
  time: number;
  price: number;
}

// Historically grounded start prices for each range, expressed against the
// BASELINE_PRICE. When the live price differs, every level is rescaled by the
// same ratio so the chart's shape and percentage moves stay plausible.
const RANGE_START: Record<TimeRange, number> = {
  "1D": 3118.5,   // Today's open — tight intraday range ~$30
  "1W": 3054.2,   // One week ago
  "1M": 2971.8,   // One month ago
  "3M": 2762.3,   // Three months ago
  "6M": 2488.6,   // Six months ago
  "1Y": 2164.4,   // One year ago
  "5Y": 1682.0,   // Five years ago
};

// Per-step log-volatility tuned to each range's typical daily move
const RANGE_VOL: Record<TimeRange, number> = {
  "1D": 0.00038,  // ~0.04%/min → realistic intraday range of ~$20-35
  "1W": 0.0048,
  "1M": 0.0082,
  "3M": 0.0095,
  "6M": 0.0115,
  "1Y": 0.0135,
  "5Y": 0.0160,
};

// Number of data points per range
const RANGE_POINTS: Record<TimeRange, number> = {
  "1D": 390,   // 1-minute bars across a 6.5-hour session
  "1W": 168,   // Hourly bars for 7 days
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 252,   // Trading days
  "5Y": 260,   // Weekly bars
};

// Milliseconds between each data point
const RANGE_INTERVAL_MS: Record<TimeRange, number> = {
  "1D": 60 * 1000,
  "1W": 60 * 60 * 1000,
  "1M": 24 * 60 * 60 * 1000,
  "3M": 24 * 60 * 60 * 1000,
  "6M": 24 * 60 * 60 * 1000,
  "1Y": 24 * 60 * 60 * 1000,
  "5Y": 7 * 24 * 60 * 60 * 1000,
};

// Seeded LCG — deterministic per range so the chart is stable between renders
function seededRng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Box-Muller transform: uniform → Gaussian
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

  // Unique seed per range — always same shape for same range
  const seed = range.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7) * 31, 1337);
  const rng = seededRng(seed);

  // Log-space drift that steers start → end over n steps (base drift)
  const baseDrift = (Math.log(endPrice) - Math.log(startPrice)) / n;

  const logPrices: number[] = [Math.log(startPrice)];

  for (let i = 1; i < n; i++) {
    const prev = logPrices[i - 1];
    const remaining = n - i;

    // Gentle bridge pull in last 15% of points so we land near current price
    const bridgePull =
      remaining < n * 0.15
        ? ((Math.log(endPrice) - prev) / Math.max(remaining, 1)) * 0.5
        : 0;

    // Occasionally spike volatility (news events, macro data releases)
    const volMultiplier = rng() < 0.03 ? 2.0 + rng() * 2.0 : 1.0;

    const step = baseDrift + bridgePull + vol * volMultiplier * gaussian(rng);
    logPrices.push(prev + step);
  }

  let prices = logPrices.map((lp) => Math.round(Math.exp(lp) * 100) / 100);

  // Clamp to a plausible band around the current level
  prices = prices.map((p) =>
    Math.min(endPrice * 1.6, Math.max(endPrice * 0.3, p))
  );

  // Insert sideways consolidation zones (realistic market texture)
  if (range !== "1D" && range !== "1W") {
    let cursor = Math.floor(rng() * n * 0.25);
    while (cursor < n * 0.78) {
      if (rng() < 0.28) {
        const zoneLen = 4 + Math.floor(rng() * 12);
        const level = prices[cursor];
        const band = level * 0.004;
        for (let j = cursor; j < Math.min(cursor + zoneLen, n - 2); j++) {
          prices[j] = Math.round((level + (rng() - 0.5) * 2 * band) * 100) / 100;
        }
        cursor += zoneLen;
      }
      cursor += 2 + Math.floor(rng() * 6);
    }
  }

  // Pin last point to exact current price
  prices[prices.length - 1] = endPrice;

  return prices.map((price, i) => ({
    time: now - (n - i) * intervalMs,
    price,
  }));
}

export function useGoldData(range: TimeRange) {
  const { spotPrice, anchorPrice, isLive } = useGoldPrice();
  const [data, setData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Anchor the generated history was built against; regenerate only when the
  // live price moves meaningfully (e.g. first real fetch replacing baseline),
  // not on every 30s poll.
  const generatedAnchor = useRef<number | null>(null);

  const load = useCallback(
    (anchor: number) => {
      setIsLoading(true);
      generatedAnchor.current = anchor;
      setTimeout(() => {
        setData(generateData(range, anchor));
        setIsLoading(false);
      }, 300);
    },
    [range]
  );

  useEffect(() => {
    load(anchorPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    const prev = generatedAnchor.current;
    if (prev !== null && Math.abs(anchorPrice - prev) / prev > 0.003) {
      load(anchorPrice);
    }
  }, [anchorPrice, load]);

  // Keep the last chart point in sync with the ticking spot price
  useEffect(() => {
    setData((d) => {
      if (!d.length) return d;
      const updated = [...d];
      updated[updated.length - 1] = { time: Date.now(), price: spotPrice };
      return updated;
    });
  }, [spotPrice]);

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
    scale: anchorPrice / BASELINE_PRICE,
  };
}
