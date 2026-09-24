import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";

import Colors from "@/constants/colors";

// Looping motion mockups for the first-launch intro. Each demo plays the
// real feature as an animation of the app's own UI — no bundled video, so
// they stay tiny, sharp on every screen, and show live-ish data.

const CYCLE = 6400; // ms; all scan-demo phases share it so they stay in sync

/** 0→1 progress that loops forever over the shared cycle. */
function useCycle(): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.linear }),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return t;
}

/** Visible between [from, to] (cycle fractions), with quick fades. */
function usePhaseStyle(
  t: SharedValue<number>,
  from: number,
  to: number,
  slide = 0
) {
  return useAnimatedStyle(() => {
    const fadeIn = 0.03;
    const fadeOut = 0.04;
    const o = interpolate(
      t.value,
      [from, from + fadeIn, to - fadeOut, to],
      [0, 1, 1, 0],
      "clamp"
    );
    return {
      opacity: o,
      transform: [
        {
          translateY: interpolate(
            t.value,
            [from, from + fadeIn],
            [slide, 0],
            "clamp"
          ),
        },
      ],
    };
  });
}

function GoldBar() {
  return (
    <LinearGradient
      colors={["#f6d879", "#d4a017", "#9c7409"]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.bar}
    >
      <Text style={styles.barMint}>SUISSE</Text>
      <Text style={styles.barWeight}>100g</Text>
      <Text style={styles.barFine}>FINE GOLD 999.9</Text>
    </LinearGradient>
  );
}

/**
 * Step-1 demo: the camera scans a bar, the shutter fires, and the add-gold
 * form fills itself from the photo — exactly what lib/goldVision.ts does.
 */
export function DemoScan() {
  const t = useCycle();

  // Sweeping scan line during the first quarter of the cycle.
  const scanStyle = useAnimatedStyle(() => {
    const phase = interpolate(t.value, [0.04, 0.3], [0, 1], "clamp");
    const sweep = Math.abs(Math.sin(phase * Math.PI * 2)); // down, up, down
    return {
      opacity: t.value < 0.04 || t.value > 0.3 ? 0 : 0.9,
      transform: [{ translateY: sweep * 64 }],
    };
  });

  // Shutter flash right after the scan.
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0.31, 0.335, 0.37],
      [0, 0.85, 0],
      "clamp"
    ),
  }));

  const row1 = usePhaseStyle(t, 0.4, 0.97, 8);
  const row2 = usePhaseStyle(t, 0.48, 0.97, 8);
  const row3 = usePhaseStyle(t, 0.56, 0.97, 8);
  const badge = usePhaseStyle(t, 0.66, 0.97, 4);

  return (
    <View style={styles.frame}>
      <View style={styles.viewfinder}>
        <GoldBar />
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
        <Animated.View style={[styles.scanLine, scanStyle]} />
        <Animated.View style={[styles.flash, flashStyle]} />
      </View>

      <View style={styles.formCol}>
        <Animated.View style={[styles.formRow, row1]}>
          <Text style={styles.formLabel}>Name</Text>
          <Text style={styles.formValue}>PAMP Suisse bar</Text>
        </Animated.View>
        <Animated.View style={[styles.formRow, row2]}>
          <Text style={styles.formLabel}>Weight</Text>
          <Text style={styles.formValue}>100 g</Text>
        </Animated.View>
        <Animated.View style={[styles.formRow, row3]}>
          <Text style={styles.formLabel}>Purity</Text>
          <Text style={styles.formValue}>24k · 999.9</Text>
        </Animated.View>
        <Animated.View style={[styles.scanBadge, badge]}>
          <Feather name="check-circle" size={13} color={Colors.dark.positive} />
          <Text style={styles.scanBadgeText}>Read from your photo</Text>
        </Animated.View>
      </View>
    </View>
  );
}

/** Step-2 demo: the two push notifications users actually receive. */
export function DemoAlerts({ priceText }: { priceText?: string | null }) {
  const t = useCycle();
  const first = usePhaseStyle(t, 0.05, 0.48, -26);
  const second = usePhaseStyle(t, 0.52, 0.95, -26);

  const banner = (title: string, body: string, style: any) => (
    <Animated.View style={[styles.notif, style]}>
      <View style={styles.notifIcon}>
        <Text style={styles.notifEmoji}>🪙</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.notifTopRow}>
          <Text style={styles.notifApp}>GOLD PRICER</Text>
          <Text style={styles.notifTime}>now</Text>
        </View>
        <Text style={styles.notifTitle}>{title}</Text>
        <Text style={styles.notifBody} numberOfLines={2}>
          {body}
        </Text>
      </View>
    </Animated.View>
  );

  const price = priceText ?? "$4,300/oz";
  return (
    <View style={[styles.frame, styles.notifFrame]}>
      {banner(
        "Gold is rallying 📈",
        `Up 1.8% today — ${price}. Your holdings just gained value.`,
        [first, styles.notifAbs]
      )}
      {banner(
        "Your morning gold brief ☀️",
        `Gold opens at ${price}. Fed comments lift bullion demand…`,
        [second, styles.notifAbs]
      )}
    </View>
  );
}

/** Step-3 demo: the Home Screen widget popping into place. */
export function DemoWidget({
  priceText,
  changeText,
}: {
  priceText?: string | null;
  changeText?: string | null;
}) {
  const pop = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(250, withSpring(1, { damping: 13, stiffness: 120 }));
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const widgetStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [
      { scale: 0.6 + pop.value * 0.4 },
      { translateY: float.value * -4 },
    ],
  }));

  const bars = [18, 24, 20, 30, 26, 36, 32, 42];
  return (
    <View style={[styles.frame, styles.homeFrame]}>
      <LinearGradient
        colors={["#1a1f3d", "#0c0f22"]}
        style={StyleSheet.absoluteFill as any}
      />
      <View style={styles.appGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={styles.appDot} />
        ))}
      </View>
      <Animated.View style={[styles.widget, widgetStyle]}>
        <View style={styles.widgetTopRow}>
          <Text style={styles.widgetLabel}>GOLD</Text>
          <View style={styles.liveDotSmall} />
        </View>
        <Text style={styles.widgetPrice}>{priceText ?? "$4,300"}</Text>
        <Text style={styles.widgetChange}>{changeText ?? "+1.8% today"}</Text>
        <View style={styles.widgetChart}>
          {bars.map((h, i) => (
            <View key={i} style={[styles.widgetBar, { height: h }]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function SparkBar({
  t,
  index,
  count,
  height,
}: {
  t: SharedValue<number>;
  index: number;
  count: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const reveal = interpolate(
      t.value,
      [index / count, (index + 1) / count],
      [0, 1],
      "clamp"
    );
    return {
      height: 4 + reveal * (height - 4),
      opacity: 0.35 + reveal * 0.65,
    };
  });
  return <Animated.View style={[styles.sparkBar, style]} />;
}

const SPARK_HEIGHTS = [14, 18, 16, 22, 20, 26, 24, 31, 28, 34, 33, 40];

/** Welcome demo: a sparkline drawing itself under the live price. */
export function DemoSpark() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        withDelay(2400, withTiming(0, { duration: 350 }))
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.spark}>
      {SPARK_HEIGHTS.map((h, i) => (
        <SparkBar
          key={i}
          t={t}
          index={i}
          count={SPARK_HEIGHTS.length}
          height={h}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    overflow: "hidden",
  },
  // --- scan demo
  viewfinder: {
    width: 118,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#0a0a0c",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bar: {
    width: 86,
    height: 56,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  barMint: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(60,42,0,0.85)",
    letterSpacing: 1.5,
  },
  barWeight: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "rgba(60,42,0,0.9)",
    marginTop: 1,
  },
  barFine: {
    fontSize: 6.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(60,42,0,0.7)",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  corner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: Colors.dark.gold,
  },
  cornerTL: { top: 7, left: 7, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 5 },
  cornerTR: { top: 7, right: 7, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 5 },
  cornerBL: { bottom: 7, left: 7, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 5 },
  cornerBR: { bottom: 7, right: 7, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 5 },
  scanLine: {
    position: "absolute",
    top: 14,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.dark.gold,
    shadowColor: Colors.dark.gold,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
  },
  formCol: {
    flex: 1,
    gap: 7,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  formLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  formValue: {
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  scanBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  scanBadgeText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.positive,
  },
  // --- alerts demo
  notifFrame: {
    height: 118,
    backgroundColor: "#101018",
  },
  notifAbs: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 16,
  },
  notif: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(44,44,50,0.96)",
    borderRadius: 16,
    padding: 11,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  notifIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#0a0a0c",
    alignItems: "center",
    justifyContent: "center",
  },
  notifEmoji: { fontSize: 18 },
  notifTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notifApp: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.6,
  },
  notifTime: {
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  notifTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginTop: 1,
  },
  notifBody: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  // --- widget demo
  homeFrame: {
    height: 150,
    justifyContent: "center",
  },
  appGrid: {
    position: "absolute",
    right: 14,
    top: 14,
    bottom: 14,
    width: 92,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignContent: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  appDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  widget: {
    width: 158,
    borderRadius: 20,
    backgroundColor: "#161619",
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  widgetTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  widgetLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 1.2,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.positive,
  },
  widgetPrice: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  widgetChange: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.positive,
    marginTop: 1,
  },
  widgetChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 8,
    height: 42,
  },
  widgetBar: {
    flex: 1,
    borderRadius: 2.5,
    backgroundColor: Colors.dark.gold,
    opacity: 0.85,
  },
  // --- welcome sparkline
  spark: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 44,
    alignSelf: "stretch",
    paddingHorizontal: 26,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2.5,
    backgroundColor: Colors.dark.gold,
  },
});
