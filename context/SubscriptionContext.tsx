import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Product,
  type Purchase,
} from "expo-iap";

export type PlanId = "free" | "tracker_monthly" | "lifetime";

// Product identifiers — must match the In-App Purchases created in
// App Store Connect exactly.
export const SKU_MONTHLY = "goldpricer.pro.monthly"; // auto-renewable
export const SKU_LIFETIME = "goldpricer.pro.lifetime"; // non-consumable

export interface SubscriptionState {
  planId: PlanId;
}

export interface PlanPricing {
  monthly: string; // localized price string, e.g. "$0.99"
  lifetime: string;
}

interface SubscriptionContextValue {
  subscription: SubscriptionState;
  isLoading: boolean;
  isPro: boolean;
  maxItems: number;
  /** Localized store prices (fallback strings until products load) */
  pricing: PlanPricing;
  /** True once real store products have loaded */
  storeReady: boolean;
  /** Start a real purchase; entitlement lands via the purchase listener */
  subscribe: (planId: Exclude<PlanId, "free">) => Promise<void>;
  /** Restore prior purchases from the App Store */
  restore: () => Promise<boolean>;
  /** Locally revert to the free tier (does NOT refund or cancel billing) */
  revertToFree: () => Promise<void>;
}

const FREE_LIMIT = 2;
const STORAGE_KEY = "@gold_subscription_v2";
const FALLBACK_PRICING: PlanPricing = { monthly: "$0.99", lifetime: "$9.99" };

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: { planId: "free" },
  isLoading: true,
  isPro: false,
  maxItems: FREE_LIMIT,
  pricing: FALLBACK_PRICING,
  storeReady: false,
  subscribe: async () => {},
  restore: async () => false,
  revertToFree: async () => {},
});

function planForSku(sku: string): PlanId | null {
  if (sku === SKU_MONTHLY) return "tracker_monthly";
  if (sku === SKU_LIFETIME) return "lifetime";
  return null;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionState>({
    planId: "free",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pricing, setPricing] = useState<PlanPricing>(FALLBACK_PRICING);
  const [storeReady, setStoreReady] = useState(false);
  const connectedRef = useRef(false);

  const applyPlan = useCallback(async (planId: PlanId) => {
    setSubscription({ planId });
    if (planId === "free") {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } else {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ planId })
      ).catch(() => {});
    }
  }, []);

  // Restore cached entitlement instantly, then connect to the store.
  useEffect(() => {
    let purchaseSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as SubscriptionState;
          if (saved?.planId) setSubscription({ planId: saved.planId });
        }
      } catch {}
      setIsLoading(false);

      if (Platform.OS === "web") return;
      try {
        await initConnection();
        connectedRef.current = true;

        // A purchase can complete at any time (including deferred/renewals)
        purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          const plan = planForSku(purchase.productId);
          if (!plan) return;
          try {
            await finishTransaction({ purchase, isConsumable: false });
          } catch {}
          await applyPlan(plan);
        });
        errorSub = purchaseErrorListener((err) => {
          // A dismissed payment sheet is not an error
          if (err?.code !== "user-cancelled") {
            Alert.alert(
              "Purchase failed",
              err?.message ?? "The App Store could not complete the purchase."
            );
          }
        });

        const [products, subs] = await Promise.all([
          fetchProducts({ skus: [SKU_LIFETIME], type: "in-app" }).catch(
            () => [] as Product[]
          ),
          fetchProducts({ skus: [SKU_MONTHLY], type: "subs" }).catch(
            () => [] as Product[]
          ),
        ]);
        const lifetime = (products ?? []).find((p) => p.id === SKU_LIFETIME);
        const monthly = (subs ?? []).find((p) => p.id === SKU_MONTHLY);
        if (lifetime || monthly) {
          setPricing({
            lifetime: lifetime?.displayPrice ?? FALLBACK_PRICING.lifetime,
            monthly: monthly?.displayPrice ?? FALLBACK_PRICING.monthly,
          });
          setStoreReady(true);
        }
      } catch {
        // Store unavailable (simulator, agreement not signed yet) — the
        // paywall explains instead of pretending to charge.
      }
    })();

    return () => {
      purchaseSub?.remove();
      errorSub?.remove();
      if (connectedRef.current) {
        endConnection().catch(() => {});
        connectedRef.current = false;
      }
    };
  }, [applyPlan]);

  const subscribe = useCallback(
    async (planId: Exclude<PlanId, "free">) => {
      if (!storeReady) {
        Alert.alert(
          "Purchases unavailable",
          "The App Store products could not be loaded. Please try again later."
        );
        return;
      }
      if (planId === "lifetime") {
        await requestPurchase({
          request: { apple: { sku: SKU_LIFETIME } },
          type: "in-app",
        });
      } else {
        await requestPurchase({
          request: { apple: { sku: SKU_MONTHLY } },
          type: "subs",
        });
      }
    },
    [storeReady]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const purchases = await getAvailablePurchases();
      const owned = purchases
        .map((p) => planForSku(p.productId))
        .filter(Boolean) as PlanId[];
      if (owned.includes("lifetime")) {
        await applyPlan("lifetime");
        return true;
      }
      if (owned.includes("tracker_monthly")) {
        await applyPlan("tracker_monthly");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [applyPlan]);

  const revertToFree = useCallback(async () => {
    await applyPlan("free");
  }, [applyPlan]);

  const isPro = subscription.planId !== "free";
  const maxItems = isPro ? Infinity : FREE_LIMIT;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        isPro,
        maxItems,
        pricing,
        storeReady,
        subscribe,
        restore,
        revertToFree,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export { FREE_LIMIT };
