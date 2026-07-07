import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SymbolView, type SFSymbol } from "expo-symbols";
import Colors from "@/constants/colors";
import { useGoldPrice, useSpotPrice, TROY_OUNCE_GRAMS } from "@/context/GoldPriceContext";
import * as Haptics from "expo-haptics";
import { FocusReveal } from "@/components/FocusReveal";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  interpolateColor,
  Easing,
} from "react-native-reanimated";

interface MetalItem {
  /** When set, the price text flashes green/red as this value ticks */
  liveValue?: number;
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePct: string;
  isPositive: boolean;
  /** Karat text rendered inside the icon circle (e.g. "24K") */
  iconLabel?: string;
  sfIcon?: SFSymbol;
  featherIcon: string;
}

// Popular gold purities. Price = spot × (karat / 24) — the value of the
// gold content per troy ounce at each fineness.
const PURITIES: { karat: string; fraction: number; name: string }[] = [
  { karat: "24K", fraction: 24 / 24, name: "Pure gold · 999.9 fine" },
  { karat: "22K", fraction: 22 / 24, name: "91.7% fine · 916" },
  { karat: "21K", fraction: 21 / 24, name: "87.5% fine · 875" },
  { karat: "18K", fraction: 18 / 24, name: "75.0% fine · 750" },
  { karat: "14K", fraction: 14 / 24, name: "58.3% fine · 585" },
  { karat: "10K", fraction: 10 / 24, name: "41.7% fine · 417" },
];

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MetalRow({ item, isLast }: { item: MetalItem; isLast?: boolean }) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);
  const prevLive = React.useRef(item.liveValue);

  React.useEffect(() => {
    const prev = prevLive.current;
    prevLive.current = item.liveValue;
    if (
      item.liveValue === undefined ||
      prev === undefined ||
      prev === item.liveValue
    )
      return;
    const direction = item.liveValue > prev ? 1 : -1;
    flash.value = withSequence(
      withTiming(direction, { duration: 120 }),
      withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) })
    );
  }, [item.liveValue, flash]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.value,
      [-1, 0, 1],
      [Colors.dark.negative, Colors.dark.text, Colors.dark.positive]
    ),
  }));

  const color = item.isPositive ? Colors.dark.positive : Colors.dark.negative;
  const bgColor = item.isPositive
    ? Colors.dark.positiveBackground
    : Colors.dark.negativeBackground;
  const isIOS = Platform.OS === "ios";

  return (
    <Animated.View style={rowStyle}>
    <Pressable
      onPressIn={() => {
        setPressed(true);
        scale.value = withTiming(0.985, { duration: 110 });
      }}
      onPressOut={() => {
        setPressed(false);
        scale.value = withTiming(1, { duration: 160 });
      }}
      onPress={() => Haptics.selectionAsync()}
      style={[
        styles.row,
        !isLast && styles.rowBordered,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: Colors.dark.goldFaint }]}>
        {item.iconLabel ? (
          <Text style={styles.iconLabel}>{item.iconLabel}</Text>
        ) : isIOS ? (
          <SymbolView
            name={item.sfIcon ?? "circle.fill"}
            tintColor={Colors.dark.gold}
            size={20}
          />
        ) : (
          <Feather name="circle" size={20} color={Colors.dark.gold} />
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text style={styles.rowSymbol}>{item.symbol}</Text>
        <Text style={styles.rowName}>{item.name}</Text>
      </View>

      <View style={styles.rowRight}>
        <Animated.Text style={[styles.rowPrice, priceStyle]}>
          {item.price}
        </Animated.Text>
        <View style={[styles.changeBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.changeText, { color }]}>{item.changePct}</Text>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

// Isolated so the 3s spot tick re-renders these rows only, not the screen.
// Prices are per GRAM of gold content: (spot / 31.1035) × (karat / 24).
// Every purity is a fraction of the live spot, so they share gold's day %.
function PurityRows({ dayOpen }: { dayOpen: number }) {
  const spotPrice = useSpotPrice();
  const pricePerGram = spotPrice / TROY_OUNCE_GRAMS;
  const goldPct = dayOpen ? ((spotPrice - dayOpen) / dayOpen) * 100 : 0;
  const pctText = `${goldPct >= 0 ? "+" : ""}${goldPct.toFixed(2)}%`;

  return (
    <>
      {PURITIES.map((p, i) => {
        const price = pricePerGram * p.fraction;
        return (
          <MetalRow
            key={p.karat}
            isLast={i === PURITIES.length - 1}
            item={{
              liveValue: price,
              iconLabel: p.karat,
              symbol: `${p.karat} Gold`,
              name: p.name,
              price: `${formatUsd(price)}/g`,
              change: "",
              changePct: pctText,
              isPositive: goldPct >= 0,
              featherIcon: "circle",
            }}
          />
        );
      })}
    </>
  );
}

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const { dayOpen } = useGoldPrice();
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom:
            Platform.OS === "web"
              ? insets.bottom + 34 + 84
              : insets.bottom + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <FocusReveal offset={12}>
        <Text style={styles.pageTitle}>Watchlist</Text>
      </FocusReveal>

      <FocusReveal delay={40} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gold by Purity</Text>
      </FocusReveal>

      <FocusReveal delay={55} style={styles.unitBanner}>
        <Feather name="info" size={14} color={Colors.dark.gold} />
        <Text style={styles.unitBannerText}>
          All prices shown are for{" "}
          <Text style={styles.unitBannerStrong}>1 gram</Text> of gold at each
          purity, based on the live spot price.
        </Text>
      </FocusReveal>

      <FocusReveal delay={70} style={styles.card}>
        <PurityRows dayOpen={dayOpen} />
      </FocusReveal>

      <FocusReveal delay={140} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Market Overview</Text>
      </FocusReveal>

      <FocusReveal delay={200} style={styles.overviewGrid}>
        {[
          {
            label: "USD Index",
            value: "103.42",
            change: "-0.18%",
            isPositive: false,
          },
          {
            label: "US 10Y Yield",
            value: "4.52%",
            change: "+0.03%",
            isPositive: true,
          },
          {
            label: "Crude Oil",
            value: "$78.40",
            change: "+0.64%",
            isPositive: true,
          },
          { label: "S&P 500", value: "5,214", change: "+0.28%", isPositive: true },
        ].map((item) => {
          const color = item.isPositive
            ? Colors.dark.positive
            : Colors.dark.negative;
          return (
            <View key={item.label} style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>{item.label}</Text>
              <Text style={styles.overviewValue}>{item.value}</Text>
              <Text style={[styles.overviewChange, { color }]}>
                {item.change}
              </Text>
            </View>
          );
        })}
      </FocusReveal>

      <FocusReveal delay={280} style={styles.goldFactsCard}>
        <Text style={styles.goldFactsTitle}>Gold Facts</Text>
        {[
          { icon: "globe", text: "1 troy ounce = 31.103 grams" },
          { icon: "bar-chart-2", text: "Over 197,000 tonnes ever mined" },
          { icon: "shield", text: "COMEX is the world's largest gold futures market" },
          { icon: "zap", text: "Gold conducts electricity and never corrodes" },
        ].map((fact) => (
          <View key={fact.text} style={styles.factRow}>
            <View style={styles.factIconContainer}>
              <Feather name={fact.icon as any} size={14} color={Colors.dark.gold} />
            </View>
            <Text style={styles.factText}>{fact.text}</Text>
          </View>
        ))}
      </FocusReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: -0.3,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowSymbol: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  rowName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  rowPrice: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    marginTop: 4,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  unitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.3)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  unitBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  unitBannerStrong: {
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  overviewCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    width: "47.5%",
    gap: 4,
  },
  overviewLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  overviewChange: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  goldFactsCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  goldFactsTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  factText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    flex: 1,
  },
});
