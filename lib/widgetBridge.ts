import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";

// Shared container between the app and its WidgetKit extension / Live Activity.
// Must match the App Group in targets/widget/expo-target.config.js and both
// provisioning profiles.
export const APP_GROUP = "group.com.mbeidas.goldtracker";

// Single object the native widget reads out of the shared UserDefaults suite.
// Keep it flat (strings/numbers only) — ExtensionStorage serialises it into a
// plist dictionary the Swift side reads with `dictionary(forKey:)`.
export const WIDGET_KEY = "goldWidget";

export interface WidgetSnapshot {
  /** Live spot price, USD per troy ounce. Fallback if the widget can't fetch. */
  price: number;
  /** Session open / previous close, for the day-change figure. */
  prevClose: number;
  /** Total pure-gold-equivalent grams across the user's holdings. */
  pureGrams: number;
  /** Total amount invested, USD. */
  costBasis: number;
  /** Number of holdings. */
  holdingsCount: number;
  /** Epoch seconds of this snapshot. */
  updatedAt: number;
}

const storage =
  Platform.OS === "ios" ? new ExtensionStorage(APP_GROUP) : null;

/**
 * Publish the latest price + portfolio figures to the App Group and nudge
 * WidgetKit to redraw. No-op off iOS or if the native module is unavailable
 * (Expo Go, simulator without the extension, etc.).
 */
export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  if (!storage) return;
  try {
    storage.set(WIDGET_KEY, {
      price: round(snapshot.price),
      prevClose: round(snapshot.prevClose),
      pureGrams: round(snapshot.pureGrams, 4),
      costBasis: round(snapshot.costBasis),
      holdingsCount: Math.round(snapshot.holdingsCount),
      updatedAt: Math.round(snapshot.updatedAt),
    });
    ExtensionStorage.reloadWidget();
  } catch {
    // Native module missing or storage unavailable — widgets just keep their
    // last snapshot. Never let this break the app.
  }
}

function round(value: number, dp = 2): number {
  if (!isFinite(value)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}
