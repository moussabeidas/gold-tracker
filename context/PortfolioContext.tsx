import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { setPersonProps, track, flush } from "@/lib/analytics";

export interface GoldPurchase {
  id: string;
  type: "bar" | "coin";
  name: string;
  weightGrams: number;
  pricePaid: number;
  purchaseDate: string;
  imageUri?: string;
  notes?: string;
  createdAt: number;
}

interface PortfolioContextValue {
  purchases: GoldPurchase[];
  isLoading: boolean;
  addPurchase: (purchase: Omit<GoldPurchase, "id" | "createdAt">) => Promise<void>;
  updatePurchase: (
    id: string,
    changes: Partial<Omit<GoldPurchase, "id" | "createdAt">>
  ) => Promise<void>;
  removePurchase: (id: string) => Promise<void>;
  totalWeightGrams: number;
  totalInvested: number;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  purchases: [],
  isLoading: true,
  addPurchase: async () => {},
  updatePurchase: async () => {},
  removePurchase: async () => {},
  totalWeightGrams: 0,
  totalInvested: 0,
});

const STORAGE_KEY = "@gold_portfolio_purchases";

export function PortfolioProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: string | null;
}) {
  const [purchases, setPurchases] = useState<GoldPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          setPurchases(JSON.parse(raw));
        } else {
          setPurchases([]);
        }
      } catch {
        setPurchases([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [storageKey]);

  const persist = useCallback(
    async (items: GoldPurchase[]) => {
      await AsyncStorage.setItem(storageKey, JSON.stringify(items));
    },
    [storageKey]
  );

  const addPurchase = useCallback(
    async (purchase: Omit<GoldPurchase, "id" | "createdAt">) => {
      const newItem: GoldPurchase = {
        ...purchase,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
        createdAt: Date.now(),
      };
      setPurchases((prev) => {
        const updated = [newItem, ...prev];
        persist(updated);
        return updated;
      });
      // Flushed immediately: the referral program's server-side check
      // requires this event before a redeemed code counts.
      track("gold_added", { grams: purchase.weightGrams, type: purchase.type });
      flush().catch(() => {});
    },
    [persist]
  );

  const updatePurchase = useCallback(
    async (
      id: string,
      changes: Partial<Omit<GoldPurchase, "id" | "createdAt">>
    ) => {
      setPurchases((prev) => {
        const updated = prev.map((p) =>
          p.id === id ? { ...p, ...changes } : p
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const removePurchase = useCallback(
    async (id: string) => {
      setPurchases((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const totalWeightGrams = purchases.reduce(
    (sum, p) => sum + p.weightGrams,
    0
  );
  const totalInvested = purchases.reduce((sum, p) => sum + p.pricePaid, 0);

  // Keep the analytics person profile in sync so the dashboard can answer
  // "how many users hold gold and how much" without a custom backend.
  const lastSnapshot = React.useRef("");
  useEffect(() => {
    if (isLoading) return;
    const grams = Math.round(totalWeightGrams * 100) / 100;
    const invested = Math.round(totalInvested * 100) / 100;
    const key = `${purchases.length}|${grams}|${invested}`;
    if (key === lastSnapshot.current) return;
    lastSnapshot.current = key;
    setPersonProps({
      holdings_count: purchases.length,
      total_weight_grams: grams,
      total_invested_usd: invested,
    });
    // The backend keeps the latest snapshot per user to sum portfolio
    // totals across the whole user base.
    track("portfolio_snapshot", {
      holdings: purchases.length,
      grams,
      invested_usd: invested,
    });
  }, [isLoading, purchases.length, totalWeightGrams, totalInvested]);

  return (
    <PortfolioContext.Provider
      value={{
        purchases,
        isLoading,
        addPurchase,
        updatePurchase,
        removePurchase,
        totalWeightGrams,
        totalInvested,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
