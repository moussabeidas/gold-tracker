import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Colors from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

interface PriceHeaderProps {
  currentPrice: number;
  change: number;
  changePct: number;
  isPositive: boolean;
  scrubPrice: number | null;
}

function formatPrice(price: number) {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PriceHeader({
  currentPrice,
  change,
  changePct,
  isPositive,
  scrubPrice,
}: PriceHeaderProps) {
  const displayPrice = scrubPrice ?? currentPrice;
  const color = isPositive ? Colors.dark.positive : Colors.dark.negative;
  const bgColor = isPositive
    ? Colors.dark.positiveBackground
    : Colors.dark.negativeBackground;
  const iconName = isPositive ? "caret-up" : "caret-down";

  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>XAU/USD</Text>
      <Text style={styles.price}>${formatPrice(displayPrice)}</Text>
      {scrubPrice === null && (
        <View style={[styles.badge, { backgroundColor: bgColor }]}>
          <Ionicons name={iconName} size={11} color={color} style={styles.caret} />
          <Text style={[styles.changeText, { color }]}>
            {isPositive ? "+" : ""}
            {formatPrice(Math.abs(change))} ({isPositive ? "+" : ""}
            {changePct.toFixed(2)}%)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 4,
  },
  symbol: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -1,
    lineHeight: 50,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 2,
  },
  caret: {
    marginTop: 1,
  },
  changeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
