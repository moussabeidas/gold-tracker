import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

// Fallback XAU/USD baseline used until the first live fetch succeeds
// (and permanently if the device is offline).
export const BASELINE_PRICE = 3150.4;
export const TROY_OUNCE_GRAMS = 31.1035;

// Free, keyless spot-price API. Returns { name, price, symbol, updatedAt }.
const PRICE_API_URL = "https://api.gold-api.com/price/XAU";
const FETCH_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 3_000;

// Today's open sits slightly below spot; same ratio the 1D chart uses so the
// change badge on the watchlist agrees with the chart tab.
const DAY_OPEN_RATIO = 3118.5 / 3150.4;

interface GoldPriceContextValue {
  /** Ticking display price in USD per troy ounce */
  spotPrice: number;
  /** Last confirmed price (live fetch, or baseline when offline) */
  anchorPrice: number;
  /** Ticking price in USD per gram */
  pricePerGram: number;
  /** Approximate session open, for day-change calculations */
  dayOpen: number;
  /** True once a real market price has been fetched */
  isLive: boolean;
  lastUpdated: number | null;
}

const GoldPriceContext = createContext<GoldPriceContextValue>({
  spotPrice: BASELINE_PRICE,
  anchorPrice: BASELINE_PRICE,
  pricePerGram: BASELINE_PRICE / TROY_OUNCE_GRAMS,
  dayOpen: BASELINE_PRICE * DAY_OPEN_RATIO,
  isLive: false,
  lastUpdated: null,
});

function isPlausiblePrice(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value > 500 && value < 20000;
}

export function GoldPriceProvider({ children }: { children: ReactNode }) {
  const [spotPrice, setSpotPrice] = useState(BASELINE_PRICE);
  const [anchorPrice, setAnchorPrice] = useState(BASELINE_PRICE);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const anchorRef = useRef(BASELINE_PRICE);

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
        anchorRef.current = price;
        setAnchorPrice(price);
        setSpotPrice(price);
        setIsLive(true);
        setLastUpdated(Date.now());
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

  return (
    <GoldPriceContext.Provider
      value={{
        spotPrice,
        anchorPrice,
        pricePerGram: spotPrice / TROY_OUNCE_GRAMS,
        dayOpen: anchorPrice * DAY_OPEN_RATIO,
        isLive,
        lastUpdated,
      }}
    >
      {children}
    </GoldPriceContext.Provider>
  );
}

export function useGoldPrice(): GoldPriceContextValue {
  return useContext(GoldPriceContext);
}
