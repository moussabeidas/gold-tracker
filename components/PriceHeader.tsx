import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

interface PriceHeaderProps {
  currentPrice: number;
  change: number;
  changePct: number;
  isPositive: boolean;
  scrubPrice: number | null;
  isLive?: boolean;
}

function formatPrice(price: number) {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function LiveIndicator() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.liveContainer}>
      <Animated.View style={[styles.liveDot, dotStyle]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

export function PriceHeader({
  currentPrice,
  change,
  changePct,
  isPositive,
  scrubPrice,
  isLive = false,
}: PriceHeaderProps) {
  const displayPrice = scrubPrice ?? currentPrice;
  const color = isPositive ? Colors.dark.positive : Colors.dark.negative;
  const bgColor = isPositive
    ? Colors.dark.positiveBackground
    : Colors.dark.negativeBackground;
  const iconName = isPositive ? "caret-up" : "caret-down";

  return (
    <View style={styles.container}>
      <View style={styles.symbolRow}>
        <Text style={styles.symbol}>XAU/USD</Text>
        {isLive && scrubPrice === null && <LiveIndicator />}
      </View>
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
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbol: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  liveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.positiveBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.positive,
  },
  liveText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.positive,
    letterSpacing: 0.8,
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
