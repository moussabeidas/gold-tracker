import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { TROY_OUNCE_GRAMS } from "@/context/GoldPriceContext";
import type { GoldPurchase } from "@/context/PortfolioContext";
import { useCurrency } from "@/context/CurrencyContext";
import { fetchSeries, type Candle } from "@/lib/marketData";
import { track } from "@/lib/analytics";

const CHART_H = 150;
const DAY_MS = 24 * 60 * 60 * 1000;
const GOLD_SYMBOLS = ["XAUUSD=X", "GC=F"];

interface Point {
  time: number;
  value: number;
  cost: number;
}

function purchaseTime(p: GoldPurchase): number {
  const t = Date.parse(p.purchaseDate);
  return isFinite(t) ? t : p.createdAt;
}

/**
 * Walk the daily gold series once, adding each holding on its purchase day,
 * so the value line steps up when gold was bought and tracks the market in
 * between. Cost is what was paid for everything held by that day.
 */
function buildPoints(candles: Candle[], purchases: GoldPurchase[]): Point[] {
  const sorted = [...purchases].sort((a, b) => purchaseTime(a) - purchaseTime(b));
  const start = purchaseTime(sorted[0]);
  const points: Point[] = [];
  let idx = 0;
  let grams = 0;
  let cost = 0;
  for (const c of candles) {
    if (c.time < start - DAY_MS) continue;
    while (idx < sorted.length && purchaseTime(sorted[idx]) <= c.time + DAY_MS) {
      grams += sorted[idx].weightGrams;
      cost += sorted[idx].pricePaid;
      idx++;
    }
    points.push({ time: c.time, value: grams * (c.price / TROY_OUNCE_GRAMS), cost });
  }
  return points;
}

async function fetchHistory(earliest: number): Promise<Candle[] | null> {
  const ageDays = (Date.now() - earliest) / DAY_MS;
  const [range, interval] =
    ageDays > 1800 ? ["max", "1wk"] : ageDays > 360 ? ["5y", "1wk"] : ["1y", "1d"];
  for (const symbol of GOLD_SYMBOLS) {
    const candles = await fetchSeries(symbol, range, interval, 500, 20000);
    if (candles?.length) return candles;
  }
  return null;
}

function linePath(
  points: Point[],
  pick: (p: Point) => number,
  w: number,
  min: number,
  max: number
): string {
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * w : 0);
  const y = (v: number) => CHART_H - ((v - min) / span) * (CHART_H - 8) - 4;
  return points
    .map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(pick(p)).toFixed(1)}`)
    .join(" ");
}

function thin(points: Point[], max = 160): Point[] {
  if (points.length <= max) return points;
  const stride = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/**
 * Pro: portfolio value vs. cost basis since the first purchase. Free users
 * see the card with a sample curve and an unlock button.
 */
export function PortfolioHistoryCard({
  purchases,
  isPro,
}: {
  purchases: GoldPurchase[];
  isPro: boolean;
}) {
  const { fmt } = useCurrency();
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);

  const earliest = useMemo(
    () => Math.min(...purchases.map(purchaseTime)),
    [purchases]
  );

  useEffect(() => {
    if (!isPro || !purchases.length) return;
    let cancelled = false;
    setFailed(false);
    fetchHistory(earliest).then((c) => {
      if (cancelled) return;
      if (c) setCandles(c);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isPro, earliest, purchases.length]);

  const points = useMemo(
    () => (candles && purchases.length ? thin(buildPoints(candles, purchases)) : []),
    [candles, purchases]
  );

  const openPaywall = () => {
    Haptics.selectionAsync();
    track("pro_gate_tap", { feature: "portfolio_history" });
    router.push({ pathname: "/paywall", params: { from: "history" } });
  };

  if (!purchases.length) return null;

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.title}>Your gold over time</Text>
      {!isPro && (
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      )}
    </View>
  );

  if (!isPro) {
    // Illustrative curve only — real figures stay behind the unlock.
    const sample: Point[] = Array.from({ length: 40 }, (_, i) => ({
      time: i,
      value: 100 + i * 1.6 + Math.sin(i / 2.4) * 6,
      cost: 100,
    }));
    return (
      <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
        {header}
        <Text style={styles.sub}>
          See how much your gold has gained since you bought it.
        </Text>
        {width > 0 && (
          <View style={styles.lockedChart}>
            <Svg width={width} height={CHART_H}>
              <Path
                d={linePath(sample, (p) => p.value, width, 90, 175)}
                stroke={Colors.dark.gold}
                strokeWidth={2}
                fill="none"
                opacity={0.35}
              />
              <Path
                d={linePath(sample, (p) => p.cost, width, 90, 175)}
                stroke={Colors.dark.textTertiary}
                strokeWidth={1.5}
                strokeDasharray="5,5"
                fill="none"
                opacity={0.35}
              />
            </Svg>
            <View style={styles.lockOverlay}>
              <AnimatedPressable scaleDown={0.96} onPress={openPaywall} style={styles.unlockBtn}>
                <Feather name="lock" size={14} color={Colors.dark.background} />
                <Text style={styles.unlockText}>Unlock with Pro</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}
      </View>
    );
  }

  const last = points[points.length - 1];
  const min = points.length ? Math.min(...points.map((p) => Math.min(p.value, p.cost))) : 0;
  const max = points.length ? Math.max(...points.map((p) => Math.max(p.value, p.cost))) : 1;
  const gain = last ? last.value - last.cost : 0;
  const gainColor = gain >= 0 ? Colors.dark.positive : Colors.dark.negative;
  const valuePath = width > 0 && points.length > 1 ? linePath(points, (p) => p.value, width, min, max) : "";
  const since = new Date(earliest).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
      {header}
      {last ? (
        <Text style={styles.sub}>
          Since {since}:{" "}
          <Text style={{ color: gainColor, fontFamily: "Inter_700Bold" }}>
            {gain >= 0 ? "+" : "−"}
            {fmt(Math.abs(gain), { decimals: 0 })}
          </Text>
        </Text>
      ) : null}
      {valuePath ? (
        <>
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.dark.gold} stopOpacity={0.25} />
                <Stop offset="1" stopColor={Colors.dark.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={`${valuePath} L ${width} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#pvFill)" />
            <Path
              d={linePath(points, (p) => p.cost, width, min, max)}
              stroke={Colors.dark.textTertiary}
              strokeWidth={1.5}
              strokeDasharray="5,5"
              fill="none"
            />
            <Path d={valuePath} stroke={Colors.dark.gold} strokeWidth={2.2} fill="none" />
          </Svg>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: Colors.dark.gold }]} />
            <Text style={styles.legendText}>Value</Text>
            <View style={[styles.legendDot, { backgroundColor: Colors.dark.textTertiary }]} />
            <Text style={styles.legendText}>What you paid</Text>
          </View>
        </>
      ) : failed ? (
        <Text style={styles.sub}>Price history is unavailable right now.</Text>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.dark.gold} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  proBadge: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.6,
  },
  sub: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  lockedChart: {
    height: CHART_H,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  unlockText: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
    marginRight: 8,
  },
  loading: {
    height: CHART_H,
    alignItems: "center",
    justifyContent: "center",
  },
});
