import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchQuote, type Quote } from "@/lib/marketData";

// Last-resort XAU/USD baseline, used only on a fresh install that has
// never seen a live price and is offline.
export const BASELINE_PRICE = 3150.4;
export const TROY_OUNCE_GRAMS = 31.1035;

// Free, keyless spot-price API. Returns { name, price, symbol, updatedAt }.
const PRICE_API_URL = "https://api.gold-api.com/price/XAU";
const FETCH_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 3_000;
const METALS_INTERVAL_MS = 5 * 60_000;
const LAST_SPOT_KEY = "@gold_last_spot_v1";

// Approximate session open relative to spot, used only until real history
// arrives (the chart hook replaces day-change math with real data).
const DAY_OPEN_RATIO = 3118.5 / 3150.4;

export type MetalSymbol = "XAG" | "XPT" | "XPD";

interface GoldPriceContextValue {
  /** Last confirmed price (live fetch, persisted cache, or baseline) */
  anchorPrice: number;
  /** Ticking price in USD per gram */
  pricePerGram: number;
  /** Approximate session open, for day-change fallbacks */
  dayOpen: number;
  /** True once a real market price has been fetched this session */
  isLive: boolean;
  lastUpdated: number | null;
  /** Live silver/platinum/palladium quotes (null until fetched) */
  metals: Partial<Record<MetalSymbol, Quote>>;
}

// The 3s ticking price lives in its own context so ONLY the components
// that display it re-render on ticks — everything else subscribes to the
// slow-moving anchor (30s) and stays quiet while the user scrolls.
const SpotTickContext = createContext<number>(BASELINE_PRICE);

const GoldPriceContext = createContext<GoldPriceContextValue>({
  anchorPrice: BASELINE_PRICE,
  pricePerGram: BASELINE_PRICE / TROY_OUNCE_GRAMS,
  dayOpen: BASELINE_PRICE * DAY_OPEN_RATIO,
  isLive: false,
  lastUpdated: null,
  metals: {},
});

function isPlausiblePrice(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value > 500 && value < 20000;
}

const METAL_YAHOO: Record<MetalSymbol, string> = {
  XAG: "XAGUSD=X",
  XPT: "XPTUSD=X",
  XPD: "XPDUSD=X",
};

export function GoldPriceProvider({ children }: { children: ReactNode }) {
  const [spotPrice, setSpotPrice] = useState(BASELINE_PRICE);
  const [anchorPrice, setAnchorPrice] = useState(BASELINE_PRICE);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [metals, setMetals] = useState<Partial<Record<MetalSymbol, Quote>>>({});

  const anchorRef = useRef(BASELINE_PRICE);
  const liveRef = useRef(false);

  const applyAnchor = (price: number) => {
    anchorRef.current = price;
    setAnchorPrice(price);
    setSpotPrice(price);
  };

  // Restore the last real price immediately so an offline launch never
  // shows the stale hardcoded baseline.
  useEffect(() => {
    AsyncStorage.getItem(LAST_SPOT_KEY)
      .then((raw) => {
        const cached = raw ? Number(raw) : NaN;
        if (!liveRef.current && isPlausiblePrice(cached)) {
          applyAnchor(cached);
        }
      })
      .catch(() => {});
  }, []);

  // Poll the live spot price.
  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(PRICE_API_URL, { signal: controller.signal });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !isPlausiblePrice(json?.price)) return;
        const price = Math.round(json.price * 100) / 100;
        liveRef.current = true;
        applyAnchor(price);
        setIsLive(true);
        setLastUpdated(Date.now());
        AsyncStorage.setItem(LAST_SPOT_KEY, String(price)).catch(() => {});
      } catch {
        // Offline or API unavailable — keep ticking around the last anchor.
      } finally {
        clearTimeout(timeout);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, FETCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Live silver / platinum / palladium quotes, refreshed every 5 minutes.
  useEffect(() => {
    let cancelled = false;

    const fetchMetals = async () => {
      const symbols = Object.keys(METAL_YAHOO) as MetalSymbol[];
      const results = await Promise.all(
        symbols.map((s) => fetchQuote(METAL_YAHOO[s], 1, 20000))
      );
      if (cancelled) return;
      setMetals((prev) => {
        const next = { ...prev };
        symbols.forEach((s, i) => {
          if (results[i]) next[s] = results[i]!;
        });
        return next;
      });
    };

    fetchMetals();
    const interval = setInterval(fetchMetals, METALS_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Gentle mean-reverting tick between polls so the price feels alive,
  // matching how a streaming quote behaves.
  useEffect(() => {
    const tick = setInterval(() => {
      setSpotPrice((prev) => {
        const pull = (anchorRef.current - prev) * 0.2;
        const noise = (Math.random() - 0.5) * 0.9;
        return Math.round((prev + pull + noise) * 100) / 100;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  const slowValue = useMemo(
    () => ({
      anchorPrice,
      pricePerGram: anchorPrice / TROY_OUNCE_GRAMS,
      dayOpen: anchorPrice * DAY_OPEN_RATIO,
      isLive,
      lastUpdated,
      metals,
    }),
    [anchorPrice, isLive, lastUpdated, metals]
  );

  return (
    <GoldPriceContext.Provider value={slowValue}>
      <SpotTickContext.Provider value={spotPrice}>
        {children}
      </SpotTickContext.Provider>
    </GoldPriceContext.Provider>
  );
}

/** The 3s ticking display price — subscribe ONLY in leaf components. */
export function useSpotPrice(): number {
  return useContext(SpotTickContext);
}

export function useGoldPrice(): GoldPriceContextValue {
  return useContext(GoldPriceContext);
}
