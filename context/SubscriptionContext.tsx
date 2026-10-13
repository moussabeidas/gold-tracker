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
  isEligibleForIntroOfferIOS,
  type Product,
  type Purchase,
} from "expo-iap";

import { useReferral } from "@/context/ReferralContext";
import { track, flush } from "@/lib/analytics";
import { PRO_FLAG_KEY } from "@/lib/entitlement";

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
  /** Annual price spread over 12 months, in the store currency */
  annualPerMonth: string | null;
  /** How much Annual saves vs. 12 × Monthly, as a whole percent */
  annualSavingsPct: number | null;
  /** Free-trial length on Annual, when the store offers one and the user is eligible */
  annualTrialDays: number | null;
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
  /** Re-fetch store products if they haven't loaded yet */
  refreshProducts: () => Promise<boolean>;
}

const FREE_LIMIT = 2;
const STORAGE_KEY = "@gold_subscription_v2";
const FALLBACK_PRICING: PlanPricing = {
  monthly: "$4.99",
  annual: "$29.99",
  lifetime: "$79.99",
  annualPerMonth: null,
  annualSavingsPct: null,
  annualTrialDays: null,
};

function formatMoney(amount: number, currency: string | undefined): string | null {
  if (!currency || !isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return null;
  }
}

/** Free-trial length in days from the store's introductory offer, if any. */
function trialDaysOf(product: any): number | null {
  if (product?.introductoryPricePaymentModeIOS !== "free-trial") return null;
  const count = Number(product?.introductoryPriceNumberOfPeriodsIOS ?? 1) || 1;
  const unitDays: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
  const unit = unitDays[product?.introductoryPriceSubscriptionPeriodIOS ?? ""];
  return unit ? count * unit : null;
}

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
  refreshProducts: async () => false,
});

// Codes that are outcomes of normal user behavior, not failures. Matches
// "user-cancelled", "E_USER_CANCELLED", "UserCancelled" and the deferred
// (ask-to-buy) family across expo-iap versions and platforms.
function isBenignPurchaseCode(code: unknown): boolean {
  const c = String(code ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return c.includes("cancel") || c.includes("defer");
}

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
  const storeReadyRef = useRef(false);
  const loadingProductsRef = useRef<Promise<boolean> | null>(null);

  // Fetch the store products. Retryable: called at launch, again whenever
  // the paywall opens unready, and once more on a purchase attempt — a
  // single failed fetch at launch must never brick purchasing (App Review
  // rejected 1.0 for exactly that).
  const loadProducts = useCallback((): Promise<boolean> => {
    if (storeReadyRef.current) return Promise.resolve(true);
    // Join an in-flight fetch rather than failing — tapping Buy while the
    // paywall's own retry is still running must wait, not error.
    if (loadingProductsRef.current) return loadingProductsRef.current;
    const run = (async () => {
      try {
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
          const annualPrice = Number((annual as any)?.price);
          const monthlyPrice = Number((monthly as any)?.price);
          const annualCurrency = (annual as any)?.currency as string | undefined;
          const savings =
            annualPrice > 0 && monthlyPrice > 0
              ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
              : null;

          // A trial only counts if this Apple ID can still claim it.
          let trialDays = trialDaysOf(annual);
          const groupId = (annual as any)?.subscriptionGroupIdIOS as string | undefined;
          if (trialDays && groupId && Platform.OS === "ios") {
            const eligible = await isEligibleForIntroOfferIOS(groupId).catch(
              () => true
            );
            if (!eligible) trialDays = null;
          }

          setPricing({
            lifetime: lifetime?.displayPrice ?? FALLBACK_PRICING.lifetime,
            monthly: monthly?.displayPrice ?? FALLBACK_PRICING.monthly,
            annual: annual?.displayPrice ?? FALLBACK_PRICING.annual,
            annualPerMonth:
              annualPrice > 0 ? formatMoney(annualPrice / 12, annualCurrency) : null,
            annualSavingsPct: savings && savings > 0 ? savings : null,
            annualTrialDays: trialDays,
          });
          storeReadyRef.current = true;
          setStoreReady(true);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        loadingProductsRef.current = null;
      }
    })();
    loadingProductsRef.current = run;
    return run;
  }, []);

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
          track("subscribe_success", { plan });
          flush().catch(() => {});
        });
        errorSub = purchaseErrorListener((err) => {
          // Dismissed payment sheets and ask-to-buy deferrals are normal
          // outcomes, never errors.
          if (isBenignPurchaseCode(err?.code)) return;
          Alert.alert(
            "Purchase not completed",
            err?.message ??
              "The App Store could not complete the purchase. You have not been charged — please try again."
          );
        });

        // Launch-time load with backoff — sandbox and fresh installs are
        // routinely slow to serve products on the first attempt.
        for (const delay of [0, 3000, 10000]) {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          if (await loadProducts()) break;
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
  }, [applyPlan, loadProducts]);

  const subscribe = useCallback(
    async (planId: Exclude<PlanId, "free">) => {
      // If the launch-time fetch failed (flaky network, slow sandbox),
      // try again right now rather than dead-ending the purchase.
      if (!storeReadyRef.current) {
        const ok = await loadProducts();
        if (!ok) {
          Alert.alert(
            "Connecting to the App Store",
            "The store products could not be loaded. Please check your internet connection and try again in a moment."
          );
          return;
        }
      }
      try {
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
      } catch (err: any) {
        // The purchase listener shows real failures; a rejected promise
        // here is usually the user closing the sheet.
        if (!isBenignPurchaseCode(err?.code)) {
          Alert.alert(
            "Purchase not completed",
            err?.message ??
              "The App Store could not complete the purchase. You have not been charged — please try again."
          );
        }
      }
    },
    [loadProducts]
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

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(PRO_FLAG_KEY, isPro ? "1" : "0").catch(() => {});
  }, [isPro, isLoading]);

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
        refreshProducts: loadProducts,
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
