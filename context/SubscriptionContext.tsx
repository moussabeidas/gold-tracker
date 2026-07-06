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

import { useReferral } from "@/context/ReferralContext";

export type PlanId = "free" | "tracker_monthly" | "tracker_annual" | "lifetime";

// Product identifiers — must match the In-App Purchases created in
// App Store Connect exactly.
export const SKU_MONTHLY = "goldpricer.pro.monthly"; // auto-renewable
export const SKU_ANNUAL = "goldpricer.pro.annual"; // auto-renewable
export const SKU_LIFETIME = "goldpricer.pro.lifetime"; // non-consumable

export interface SubscriptionState {
  planId: PlanId;
}

export interface PlanPricing {
  monthly: string; // localized price strings, e.g. "$4.99"
  annual: string;
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
const FALLBACK_PRICING: PlanPricing = {
  monthly: "$4.99",
  annual: "$29.99",
  lifetime: "$79.99",
};

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
  if (sku === SKU_ANNUAL) return "tracker_annual";
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
          fetchProducts({ skus: [SKU_MONTHLY, SKU_ANNUAL], type: "subs" }).catch(
            () => [] as Product[]
          ),
        ]);
        const lifetime = (products ?? []).find((p) => p.id === SKU_LIFETIME);
        const monthly = (subs ?? []).find((p) => p.id === SKU_MONTHLY);
        const annual = (subs ?? []).find((p) => p.id === SKU_ANNUAL);
        if (lifetime || monthly || annual) {
          setPricing({
            lifetime: lifetime?.displayPrice ?? FALLBACK_PRICING.lifetime,
            monthly: monthly?.displayPrice ?? FALLBACK_PRICING.monthly,
            annual: annual?.displayPrice ?? FALLBACK_PRICING.annual,
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
          request: {
            apple: { sku: planId === "tracker_annual" ? SKU_ANNUAL : SKU_MONTHLY },
          },
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
      for (const plan of ["lifetime", "tracker_annual", "tracker_monthly"] as const) {
        if (owned.includes(plan)) {
          await applyPlan(plan);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [applyPlan]);

  const revertToFree = useCallback(async () => {
    await applyPlan("free");
  }, [applyPlan]);

  // Referral rewards: each verified referral adds a portfolio slot, and
  // hitting the target grants time-boxed Pro without a purchase.
  const { bonusSlots, hasReferralPro } = useReferral();

  const isPro = subscription.planId !== "free" || hasReferralPro;
  const maxItems = isPro ? Infinity : FREE_LIMIT + bonusSlots;

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
