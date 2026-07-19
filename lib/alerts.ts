import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";

import { fetchQuote, fetchNews } from "./marketData";

// Price-alert engine. Preferences live in AsyncStorage; a background task
// polls the spot price every ~15+ minutes (iOS decides the exact cadence)
// and fires a local notification when a target is crossed. The app also
// checks on every foreground price fetch, so alerts are prompt while in use.
//
// The daily brief is a one-shot notification for the next 9am whose text is
// composed from live data (overnight gold move, portfolio delta, a headline).
// Every foreground price check and every background run re-arms it, so the
// copy is as fresh as the last time the app got any execution time.

const PREFS_KEY = "@gold_alert_prefs_v1";
const FIRED_KEY = "@gold_alert_fired_v1";
const BRIEF_COMPOSED_KEY = "@gold_brief_composed_v1";
const PORTFOLIO_KEY_PREFIX = "@gold_portfolio_purchases";
const TASK_NAME = "gold-price-alert-task";
const SPOT_URL = "https://api.gold-api.com/price/XAU";
const GRAMS_PER_TROY_OZ = 31.1034768;

export interface AlertPrefs {
  /** Master switch for price alerts. */
  enabled: boolean;
  /** Notify when spot rises to or above this (USD/oz). 0 = off. */
  above: number;
  /** Notify when spot falls to or below this (USD/oz). 0 = off. */
  below: number;
  /** 9am daily brief with a nudge to check the market. */
  dailyBrief: boolean;
}

export const DEFAULT_PREFS: AlertPrefs = {
  enabled: false,
  above: 0,
  below: 0,
  dailyBrief: false,
};

export async function loadAlertPrefs(): Promise<AlertPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveAlertPrefs(prefs: AlertPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  // Changing targets re-arms them.
  await AsyncStorage.removeItem(FIRED_KEY).catch(() => {});
  await syncSchedules(prefs);
}

export async function requestAlertPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Compare the spot price against targets; notify once per arming. */
export async function checkPriceAgainstTargets(price: number): Promise<void> {
  // Piggyback on foreground price checks to keep tomorrow's brief fresh
  // (no-op unless the brief is enabled; throttled internally).
  refreshDailyBrief().catch(() => {});

  const prefs = await loadAlertPrefs();
  if (!prefs.enabled) return;

  let fired: { above?: boolean; below?: boolean } = {};
  try {
    fired = JSON.parse((await AsyncStorage.getItem(FIRED_KEY)) ?? "{}");
  } catch {}

  const notify = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null,
    }).catch(() => {});
  };

  if (prefs.above > 0 && price >= prefs.above && !fired.above) {
    fired.above = true;
    await notify(
      "Gold hit your target 🎯",
      `Spot gold is $${price.toFixed(2)} — at or above your $${prefs.above.toFixed(0)} alert.`
    );
  }
  if (prefs.below > 0 && price <= prefs.below && !fired.below) {
    fired.below = true;
    await notify(
      "Gold dipped to your target 📉",
      `Spot gold is $${price.toFixed(2)} — at or below your $${prefs.below.toFixed(0)} alert.`
    );
  }
  await AsyncStorage.setItem(FIRED_KEY, JSON.stringify(fired)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Daily brief content
// ---------------------------------------------------------------------------

/** Total grams across every stored portfolio (guest and per-user keys). */
async function readPortfolioGrams(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const portfolioKeys = keys.filter((k) => k.startsWith(PORTFOLIO_KEY_PREFIX));
    let best = 0;
    for (const key of portfolioKeys) {
      try {
        const items = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
        if (!Array.isArray(items)) continue;
        const grams = items.reduce(
          (sum: number, p: any) =>
            sum + (typeof p?.weightGrams === "number" ? p.weightGrams : 0),
          0
        );
        // Guest and signed-in portfolios can coexist; brief the larger one.
        best = Math.max(best, grams);
      } catch {}
    }
    return best;
  } catch {
    return 0;
  }
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : 2;
  return abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Compose today's brief from live data; falls back to the generic nudge. */
async function composeBriefContent(): Promise<{ title: string; body: string }> {
  const fallback = {
    title: "Morning gold brief ☀️",
    body: "See how gold moved overnight and where your portfolio stands.",
  };
  try {
    const [quote, grams, stories] = await Promise.all([
      fetchQuote("XAUUSD=X", 500, 20000).then(
        (q) => q ?? fetchQuote("GC=F", 500, 20000)
      ),
      readPortfolioGrams(),
      fetchNews("gold price market", 3).catch(() => null),
    ]);
    if (!quote) return fallback;

    const up = quote.changePct >= 0;
    const pct = Math.abs(quote.changePct).toFixed(1);
    const arrow = up ? "📈" : "📉";
    const dir = up ? "up" : "down";
    const title = `Gold ${dir} ${pct}% this morning ${arrow}`;

    let body: string;
    if (grams > 0) {
      const deltaUsd =
        (grams / GRAMS_PER_TROY_OZ) * (quote.price - quote.prevClose);
      const gained = deltaUsd >= 0 ? "gained" : "lost";
      body =
        `Gold is ${dir} ${pct}% overnight at $${fmtUsd(quote.price)}/oz — ` +
        `your ${Math.round(grams)}g holding ${gained} $${fmtUsd(deltaUsd)}.`;
    } else {
      body = `Gold is ${dir} ${pct}% overnight at $${fmtUsd(quote.price)}/oz.`;
    }

    const headline = stories?.[0]?.title?.trim();
    if (headline) {
      const publisher = stories?.[0]?.publisher?.trim();
      body += ` ${headline}${publisher ? ` — ${publisher}` : ""}`;
    }
    return { title, body };
  } catch {
    return fallback;
  }
}

function nextNineAm(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Re-arm the next-9am brief with freshly composed content. Throttled so
 * frequent foreground price checks don't hammer the quote/news endpoints.
 */
export async function refreshDailyBrief(force = false): Promise<void> {
  if (Platform.OS === "web") return;
  const prefs = await loadAlertPrefs();
  if (!prefs.dailyBrief) return;

  if (!force) {
    try {
      const last = Number(await AsyncStorage.getItem(BRIEF_COMPOSED_KEY));
      if (isFinite(last) && Date.now() - last < 3 * 60 * 60 * 1000) return;
    } catch {}
  }

  const content = await composeBriefContent();
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.kind === "daily-brief") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: "default", data: { kind: "daily-brief" } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextNineAm(),
      },
    });
    await AsyncStorage.setItem(BRIEF_COMPOSED_KEY, String(Date.now()));
  } catch {}
}

// ---------------------------------------------------------------------------
// Background task
// ---------------------------------------------------------------------------

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const prefs = await loadAlertPrefs();
    if (prefs.enabled && (prefs.above > 0 || prefs.below > 0)) {
      const res = await fetch(SPOT_URL);
      if (res.ok) {
        const json = await res.json();
        const price = Number(json?.price);
        if (isFinite(price) && price > 500 && price < 20000) {
          await checkPriceAgainstTargets(price);
        }
      }
    }
    // Keep tomorrow's brief current even when the app isn't opened.
    await refreshDailyBrief();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function syncSchedules(prefs: AlertPrefs): Promise<void> {
  if (Platform.OS === "web") return;

  // Background polling runs for price targets and/or the daily brief.
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    const wantsTask =
      (prefs.enabled && (prefs.above > 0 || prefs.below > 0)) ||
      prefs.dailyBrief;
    if (wantsTask) {
      if (!registered) {
        await BackgroundTask.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15, // minutes; iOS treats this as a floor
        });
      }
    } else if (registered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    }
  } catch {}

  // Daily brief: personalized one-shot for the next 9am (or cancel it).
  if (prefs.dailyBrief) {
    await refreshDailyBrief(true);
  } else {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content.data?.kind === "daily-brief") {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }
    } catch {}
  }
}

/** Idempotent app-start hookup: notification handler + task re-registration. */
export async function initAlerts(): Promise<void> {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  const prefs = await loadAlertPrefs();
  await syncSchedules(prefs);
}
