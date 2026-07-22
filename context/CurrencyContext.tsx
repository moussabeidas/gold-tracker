import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  type CurrencyState,
  USD_STATE,
  fetchUsdRate,
  findCurrency,
  formatInCurrency,
  loadFreshCurrencyState,
  saveCurrencyState,
} from "@/lib/currency";
import { track } from "@/lib/analytics";

interface CurrencyContextValue {
  /** Active display currency (code, symbol, USD→X rate). */
  currency: CurrencyState;
  /** True while a newly selected currency's rate is loading. */
  switching: boolean;
  /** Change display currency; resolves once the FX rate is fetched. */
  setCurrency: (code: string) => Promise<boolean>;
  /** Convert a USD amount into the display currency. */
  convert: (usd: number) => number;
  /** Format a USD amount in the display currency (symbol included). */
  fmt: (usd: number, opts?: { compact?: boolean; decimals?: number }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: USD_STATE,
  switching: false,
  setCurrency: async () => false,
  convert: (usd) => usd,
  fmt: (usd) => `$${usd.toFixed(2)}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setState] = useState<CurrencyState>(USD_STATE);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadFreshCurrencyState().then(setState).catch(() => {});
  }, []);

  const setCurrency = useCallback(async (code: string): Promise<boolean> => {
    const def = findCurrency(code);
    if (!def) return false;
    if (code === "USD") {
      setState(USD_STATE);
      await saveCurrencyState(USD_STATE);
      track("currency_changed", { code });
      return true;
    }
    setSwitching(true);
    try {
      const rate = await fetchUsdRate(code);
      if (rate == null) return false;
      const next: CurrencyState = {
        code,
        symbol: def.symbol,
        rate,
        fetchedAt: Date.now(),
      };
      setState(next);
      await saveCurrencyState(next);
      track("currency_changed", { code });
      return true;
    } finally {
      setSwitching(false);
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      switching,
      setCurrency,
      convert: (usd) => usd * currency.rate,
      fmt: (usd, opts) => formatInCurrency(usd, currency, opts),
    }),
    [currency, switching, setCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
