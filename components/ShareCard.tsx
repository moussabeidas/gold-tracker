import React, { forwardRef } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useCurrency } from "@/context/CurrencyContext";

const COIN = require("@/assets/images/splash-icon.png");

export interface ShareCardData {
  price: number;
  change: number;
  changePct: number;
  isPositive: boolean;
}

// A fixed-size branded card captured off-screen and shared via the native
// share sheet. Rendered at 2x for crisp output.
export const ShareCard = forwardRef<View, { data: ShareCardData }>(
  ({ data }, ref) => {
    const { fmt } = useCurrency();
    const color = data.isPositive ? Colors.dark.positive : Colors.dark.negative;
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["#1a1407", "#0a0704", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.brandRow}>
          <Image source={COIN} style={styles.brandCoin} resizeMode="contain" />
          <Text style={styles.brandName}>Gold Pricer</Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.symbol}>GOLD · XAU/USD</Text>
          <Text style={styles.price}>{fmt(data.price, { decimals: 2 })}</Text>
          <Text style={styles.unit}>per troy ounce · 24K (999.9 fine)</Text>
          <View style={[styles.badge, { borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>
              {data.isPositive ? "▲ " : "▼ "}
              {fmt(Math.abs(data.change), { decimals: 2 })} ({data.isPositive ? "+" : ""}
              {data.changePct.toFixed(2)}%) today
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.date}>{today}</Text>
          <Text style={styles.tagline}>
            From the City of Gold to the world 🇦🇪
          </Text>
        </View>
      </View>
    );
  }
);

ShareCard.displayName = "ShareCard";

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 480,
    borderRadius: 28,
    overflow: "hidden",
    padding: 28,
    justifyContent: "space-between",
    backgroundColor: "#000",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandCoin: {
    width: 34,
    height: 34,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  center: {
    alignItems: "center",
    gap: 6,
  },
  symbol: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 54,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
  },
  badge: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    alignItems: "center",
    gap: 4,
  },
  date: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  tagline: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.gold,
  },
});
