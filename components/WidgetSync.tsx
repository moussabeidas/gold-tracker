import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useGoldPrice } from "@/context/GoldPriceContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { publishWidgetSnapshot } from "@/lib/widgetBridge";
import { initAlerts, checkPriceAgainstTargets } from "@/lib/alerts";
import { track } from "@/lib/analytics";

// Mirrors the live price + portfolio figures into the App Group so the
// WidgetKit extension (and, later, the Live Activity) can render them.
// Renders nothing — it's a side-effect sink that lives inside both providers.
export function WidgetSync() {
  const { anchorPrice, dayOpen, isLive } = useGoldPrice();
  const { totalWeightGrams, totalInvested, purchases } = usePortfolio();
  const lastPublished = useRef(0);

  // Notification handler + background alert task, once per launch.
  useEffect(() => {
    initAlerts().catch(() => {});
    track("app_open");
  }, []);

  // Prompt in-use alerting: every confirmed price also runs the target check.
  useEffect(() => {
    if (isLive) checkPriceAgainstTargets(anchorPrice).catch(() => {});
  }, [anchorPrice, isLive]);

  useEffect(() => {
    // The anchor moves every 30s; that cadence is plenty for a widget, and
    // publishing on it (rather than the 3s cosmetic tick) keeps writes cheap.
    publishWidgetSnapshot({
      price: anchorPrice,
      prevClose: dayOpen,
      pureGrams: totalWeightGrams,
      costBasis: totalInvested,
      holdingsCount: purchases.length,
      updatedAt: Math.floor(Date.now() / 1000),
    });
    lastPublished.current = Date.now();
  }, [anchorPrice, dayOpen, totalWeightGrams, totalInvested, purchases.length]);

  // Also refresh the moment the app returns to the foreground, so a widget
  // tapped after a long background stint hands off a current snapshot.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        publishWidgetSnapshot({
          price: anchorPrice,
          prevClose: dayOpen,
          pureGrams: totalWeightGrams,
          costBasis: totalInvested,
          holdingsCount: purchases.length,
          updatedAt: Math.floor(Date.now() / 1000),
        });
      }
    });
    return () => sub.remove();
  }, [anchorPrice, dayOpen, totalWeightGrams, totalInvested, purchases.length]);

  return null;
}
