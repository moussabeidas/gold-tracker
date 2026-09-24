import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as StoreReview from "expo-store-review";

import { track } from "./analytics";

// In-app App Store rating prompt (SKStoreReviewController). iOS itself
// decides whether the sheet actually appears and caps it at ~3 shows per
// user per year, so our job is only to pick good moments: regulars who
// keep coming back, never a first launch, never during onboarding.

const KEY = "rating_state_v1";
const ONBOARDING_KEY = "onboarding_v1_done";

const MIN_OPENS = 5; // total cold starts
const MIN_DAYS = 3; // distinct days used
const MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000; // installed at least 3 days
const REASK_MS = 120 * 24 * 60 * 60 * 1000; // our own re-ask spacing

interface RatingState {
  firstOpenAt: number;
  opens: number;
  dayCount: number;
  lastDay: string;
  lastAskAt: number;
}

async function loadState(): Promise<RatingState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { firstOpenAt: Date.now(), opens: 0, dayCount: 0, lastDay: "", lastAskAt: 0 };
}

async function saveState(state: RatingState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Count this cold start and, when the user has become a regular, ask iOS
 * to show the rating sheet. Call once per launch; it waits out the splash
 * and the intro on its own.
 */
export async function noteAppOpenForRating(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const state = await loadState();
  const today = new Date().toISOString().slice(0, 10);
  state.opens += 1;
  if (state.lastDay !== today) {
    state.lastDay = today;
    state.dayCount += 1;
  }
  await saveState(state);

  const now = Date.now();
  const engaged =
    state.opens >= MIN_OPENS &&
    state.dayCount >= MIN_DAYS &&
    now - state.firstOpenAt >= MIN_AGE_MS;
  const rested = now - state.lastAskAt >= REASK_MS;
  if (!engaged || !rested) return;

  // Let the app settle (splash, price load) before asking, and stand down
  // if the first-launch intro is still the user's current experience.
  setTimeout(async () => {
    try {
      const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboarded) return;
      if (!(await StoreReview.isAvailableAsync())) return;
      state.lastAskAt = Date.now();
      await saveState(state);
      track("rating_prompted", { opens: state.opens, days: state.dayCount });
      await StoreReview.requestReview();
    } catch {}
  }, 12_000);
}
