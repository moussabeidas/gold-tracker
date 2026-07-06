import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";

// Price-alert engine. Preferences live in AsyncStorage; a background task
// polls the spot price every ~15+ minutes (iOS decides the exact cadence)
// and fires a local notification when a target is crossed. The app also
// checks on every foreground price fetch, so alerts are prompt while in use.

const PREFS_KEY = "@gold_alert_prefs_v1";
const FIRED_KEY = "@gold_alert_fired_v1";
const TASK_NAME = "gold-price-alert-task";
const SPOT_URL = "https://api.gold-api.com/price/XAU";

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
// Background task
// ---------------------------------------------------------------------------

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const res = await fetch(SPOT_URL);
    if (!res.ok) return BackgroundTask.BackgroundTaskResult.Failed;
    const json = await res.json();
    const price = Number(json?.price);
    if (isFinite(price) && price > 500 && price < 20000) {
      await checkPriceAgainstTargets(price);
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function syncSchedules(prefs: AlertPrefs): Promise<void> {
  if (Platform.OS === "web") return;

  // Background polling only while alerts are on.
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (prefs.enabled && (prefs.above > 0 || prefs.below > 0)) {
      if (!registered) {
        await BackgroundTask.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15, // minutes; iOS treats this as a floor
        });
      }
    } else if (registered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    }
  } catch {}

  // Daily brief: one repeating 9am local notification.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.kind === "daily-brief") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (prefs.dailyBrief) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Morning gold brief ☀️",
          body: "See how gold moved overnight and where your portfolio stands.",
          data: { kind: "daily-brief" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 9,
          minute: 0,
        },
      });
    }
  } catch {}
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
