import { api, apiEnabled } from "@/lib/api";
import PostHog from "posthog-react-native";

// Fire-and-forget analytics. Events go to PostHog (hosted dashboard) when a
// project key is configured, and to the app's own backend when that exists.
// Both paths are optional and silent — analytics must never affect the UX.

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let posthog: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!posthog) {
    posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true, // Application Opened / Backgrounded
    });
  }
  return posthog;
}

/** Tie events to the signed-in user (called on Apple sign-in). */
export function identifyUser(
  userId: string,
  props?: Record<string, string | number | boolean>
): void {
  try {
    getPostHog()?.identify(userId, props);
  } catch {}
}

/** Person-level properties (portfolio size, plan, invite code…). */
export function setPersonProps(
  props: Record<string, string | number | boolean>
): void {
  try {
    getPostHog()?.capture("$set", { $set: props });
  } catch {}
}

export function resetAnalyticsUser(): void {
  try {
    getPostHog()?.reset();
  } catch {}
}

interface QueuedEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
  at: number;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function track(
  name: string,
  props?: Record<string, string | number | boolean>
): void {
  try {
    getPostHog()?.capture(name, props);
  } catch {}

  if (!apiEnabled()) return;
  queue.push({ name, props, at: Date.now() });
  if (queue.length >= 20) {
    void flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), 5000);
  }
}

export async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length) return;
  const batch = queue.slice(0, 50);
  queue = queue.slice(50);
  await api("/v1/events", { method: "POST", body: { events: batch } });
}
