import { api, apiEnabled } from "@/lib/api";

// Fire-and-forget analytics with a small in-memory batch queue. Events
// are dropped (never queued to disk) if the backend is unreachable —
// analytics must never affect the user experience.

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
