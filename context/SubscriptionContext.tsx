import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PlanId = "free" | "tracker_monthly" | "tracker_annual" | "lifetime";

export interface Subscription {
  planId: PlanId;
  expiresAt?: number; // unix ms, undefined = lifetime/free
}

interface SubscriptionContextValue {
  subscription: Subscription;
  isLoading: boolean;
  isPro: boolean;
  maxItems: number;
  subscribe: (planId: PlanId) => Promise<void>;
  restore: () => Promise<void>;
}

const FREE_LIMIT = 2;

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: { planId: "free" },
  isLoading: true,
  isPro: false,
  maxItems: FREE_LIMIT,
  subscribe: async () => {},
  restore: async () => {},
});

const STORAGE_KEY = "@gold_subscription";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription>({
    planId: "free",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: Subscription = JSON.parse(raw);
          // Expire check for monthly/annual plans
          if (saved.expiresAt && saved.expiresAt < Date.now()) {
            setSubscription({ planId: "free" });
            await AsyncStorage.removeItem(STORAGE_KEY);
          } else {
            setSubscription(saved);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const subscribe = useCallback(async (planId: PlanId) => {
    let expiresAt: number | undefined;
    if (planId === "tracker_monthly") {
      expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    } else if (planId === "tracker_annual") {
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    }
    const sub: Subscription = { planId, expiresAt };
    setSubscription(sub);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sub));
  }, []);

  const restore = useCallback(async () => {
    // In a real app this would call StoreKit/Google Play billing restore
    // Here we just re-read storage
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      setSubscription(JSON.parse(raw));
    }
  }, []);

  const isPro = subscription.planId !== "free";
  const maxItems = isPro ? Infinity : FREE_LIMIT;

  return (
    <SubscriptionContext.Provider
      value={{ subscription, isLoading, isPro, maxItems, subscribe, restore }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export { FREE_LIMIT };
