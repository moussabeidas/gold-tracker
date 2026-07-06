import AsyncStorage from "@react-native-async-storage/async-storage";

// Thin client for the Gold Pricer backend. The base URL comes from the
// build environment; when unset, every call no-ops and the app behaves
// exactly as the offline-first version — server features are additive.

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "@gold_api_token_v1";

let cachedToken: string | null | undefined;

export function apiEnabled(): boolean {
  return BASE_URL.length > 0;
}

export async function getSessionToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

export async function api<T = any>(
  path: string,
  { method = "GET", body, auth = true, timeoutMs = 10000 }: RequestOptions = {}
): Promise<T | null> {
  if (!apiEnabled()) return null;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getSessionToken();
    if (!token) return null;
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 401 && auth) {
      // Session expired — drop it; next Apple sign-in refreshes.
      await setSessionToken(null);
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Exchange an Apple identityToken for a backend session. */
export async function loginWithApple(input: {
  identityToken: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<boolean> {
  const result = await api<{ token: string }>("/v1/auth/apple", {
    method: "POST",
    body: input,
    auth: false,
  });
  if (result?.token) {
    await setSessionToken(result.token);
    return true;
  }
  return false;
}
