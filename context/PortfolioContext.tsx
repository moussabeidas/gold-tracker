import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  removePurchase: (id: string) => Promise<void>;
  totalWeightGrams: number;
  totalInvested: number;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  purchases: [],
  isLoading: true,
  addPurchase: async () => {},
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

  return (
    <PortfolioContext.Provider
      value={{
        purchases,
        isLoading,
        addPurchase,
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
