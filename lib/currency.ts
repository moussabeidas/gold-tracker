import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchQuote } from "./marketData";

// Display-currency system. All prices in the app are stored and computed in
// USD; the selected currency only converts values at render time using a
// live USD→X rate (Yahoo FX quote, cached for offline and for module-level
// consumers like the daily brief).

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Major currencies across the storefronts the app ships to. Symbols follow
// common local usage; codes are ISO 4217 and drive the FX quote lookup.
export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "QAR", symbol: "QAR", name: "Qatari Riyal" },
  { code: "KWD", symbol: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", symbol: "OMR", name: "Omani Rial" },
  { code: "JOD", symbol: "JOD", name: "Jordanian Dinar" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "MAD", symbol: "MAD", name: "Moroccan Dirham" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ARS", symbol: "AR$", name: "Argentine Peso" },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso" },
  { code: "COP", symbol: "CO$", name: "Colombian Peso" },
];

// Currencies whose smallest everyday unit makes cents noise (JPY, KRW…):
// show whole numbers for them.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "IDR", "VND", "CLP", "COP", "HUF"]);

export interface CurrencyState {
  code: string;
  symbol: string;
  /** USD → selected currency multiplier. 1 for USD. */
  rate: number;
  /** ms epoch of when the rate was fetched. */
  fetchedAt: number;
}

export const USD_STATE: CurrencyState = {
  code: "USD",
  symbol: "$",
  rate: 1,
  fetchedAt: 0,
};

const STATE_KEY = "@gold_display_currency_v1";
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export async function loadCurrencyState(): Promise<CurrencyState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return USD_STATE;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.code === "string" &&
      findCurrency(parsed.code) &&
      typeof parsed?.rate === "number" &&
      isFinite(parsed.rate) &&
      parsed.rate > 0
    ) {
      return {
        code: parsed.code,
        symbol: findCurrency(parsed.code)!.symbol,
        rate: parsed.rate,
        fetchedAt: Number(parsed.fetchedAt) || 0,
      };
    }
  } catch {}
  return USD_STATE;
}

export async function saveCurrencyState(state: CurrencyState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
}

/** USD→code rate via Yahoo FX; null when unavailable. */
export async function fetchUsdRate(code: string): Promise<number | null> {
  if (code === "USD") return 1;
  const q = await fetchQuote(`USD${code}=X`, 0.000001, 1000000);
  return q ? q.price : null;
}

/**
 * Load the persisted currency, refreshing its rate when stale. Never throws;
 * a failed refresh keeps the cached rate so the app stays usable offline.
 */
export async function loadFreshCurrencyState(): Promise<CurrencyState> {
  const state = await loadCurrencyState();
  if (state.code === "USD") return state;
  if (Date.now() - state.fetchedAt < RATE_TTL_MS) return state;
  const rate = await fetchUsdRate(state.code);
  if (rate == null) return state;
  const fresh = { ...state, rate, fetchedAt: Date.now() };
  await saveCurrencyState(fresh);
  return fresh;
}

/** Format a USD amount in the given display currency. */
export function formatInCurrency(
  usd: number,
  state: CurrencyState,
  opts?: { compact?: boolean; decimals?: number }
): string {
  const value = usd * state.rate;
  const zeroDecimal = ZERO_DECIMAL.has(state.code);
  const decimals =
    opts?.decimals ?? (zeroDecimal ? 0 : Math.abs(value) >= 10000 ? 0 : 2);
  const num = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: opts?.compact ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
  const sign = value < 0 ? "-" : "";
  // Alphabetic symbols (AED, CHF…) read better with a space.
  const sep = /[A-Za-z]$/.test(state.symbol) ? " " : "";
  return `${sign}${state.symbol}${sep}${num}`;
}
