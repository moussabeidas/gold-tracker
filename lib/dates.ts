// Timezone-safe helpers for the app's YYYY-MM-DD date strings.
// Manual parsing avoids "Invalid Date" from engine-specific string parsing
// and the UTC-midnight off-by-one-day trap.

export const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(value: string): Date | null {
  const m = YMD_RE.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function formatYmd(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const d = parseYmd(value);
  if (!d) return value || "—";
  return d.toLocaleDateString("en-US", options);
}
