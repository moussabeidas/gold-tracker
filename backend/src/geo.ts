// Country detection for the dashboard's geography stats. The client IP
// (from Railway's x-forwarded-for) is resolved to an ISO country code via
// ipapi.co's free endpoint — no key, HTTPS, plain-text response. Results
// are cached per IP so repeat requests cost nothing.

const cache = new Map<string, string | null>();
const CACHE_MAX = 5000;

/** First public address in a proxy chain header, or null. */
export function clientIp(forwardedFor: string | undefined): string | null {
  if (!forwardedFor) return null;
  const ip = forwardedFor.split(",")[0].trim();
  if (!ip) return null;
  // Private/loopback ranges can't be geolocated.
  if (
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|::1$|f[cd])/i.test(ip)
  ) {
    return null;
  }
  return ip;
}

export async function lookupCountry(ip: string): Promise<string | null> {
  if (cache.has(ip)) return cache.get(ip) ?? null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
      signal: controller.signal,
      headers: { "User-Agent": "goldpricer-backend/1.0" },
    });
    if (!res.ok) return null; // rate-limited or upstream error: retry next request
    const text = (await res.text()).trim().toUpperCase();
    const code = /^[A-Z]{2}$/.test(text) ? text : null;
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(ip, code);
    return code;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
