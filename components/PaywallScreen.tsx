import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolateColor,
} from "react-native-reanimated";

import Colors from "@/constants/colors";
import { useSubscription, type PlanId } from "@/context/SubscriptionContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SpinningCoin } from "@/components/SpinningCoin";

type PaidPlan = Exclude<PlanId, "free">;

const FEATURES = [
  { icon: "layers" as const, text: "Unlimited portfolio holdings" },
  { icon: "zap" as const, text: "Photo scan & auto-fill" },
  { icon: "clock" as const, text: "Historical cost lookup" },
  { icon: "star" as const, text: "First access to the Marketplace" },
];

export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { subscribe, restore, pricing, storeReady, isPro } = useSubscription();
  const [selected, setSelected] = useState<PaidPlan>("lifetime");
  const [busy, setBusy] = useState(false);

  // The preferred plan breathes: a gold glow cycles on its border
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [glow]);

  const preferredGlowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      glow.value,
      [0, 1],
      ["rgba(255,215,0,0.45)", "rgba(255,215,0,1)"]
    ),
    shadowOpacity: 0.25 + glow.value * 0.45,
    transform: [{ scale: 1 + glow.value * 0.012 }],
  }));

  // Close automatically once the store grants Pro
  useEffect(() => {
    if (isPro) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  }, [isPro]);

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      await subscribe(selected);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    Haptics.selectionAsync();
    const ok = await restore();
    Alert.alert(
      ok ? "Purchases restored" : "Nothing to restore",
      ok
        ? "Welcome back to Pro."
        : "No previous Gold Pricer Pro purchase was found for this Apple ID."
    );
  };

  const plans: {
    id: PaidPlan;
    label: string;
    price: string;
    period: string;
    note: string;
    preferred: boolean;
  }[] = [
    {
      id: "lifetime",
      label: "Lifetime",
      price: pricing.lifetime,
      period: "one-time",
      note: "Pay once, own it forever",
      preferred: true,
    },
    {
      id: "tracker_monthly",
      label: "Monthly",
      price: pricing.monthly,
      period: "per month",
      note: "Cancel anytime",
      preferred: false,
    },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedPressable
        scaleDown={0.85}
        onPress={() => router.back()}
        style={styles.closeButton}
        hitSlop={12}
      >
        <Feather name="x" size={20} color={Colors.dark.textSecondary} />
      </AnimatedPressable>

      <Animated.View
        entering={FadeInDown.duration(450).springify()}
        style={styles.hero}
      >
        <SpinningCoin size={104} periodMs={8000} />
        <Text style={styles.title}>Gold Pricer Pro</Text>
        <Text style={styles.subtitle}>
          The full vault — every feature, no limits.
        </Text>
      </Animated.View>

      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f.text}
            entering={FadeInDown.delay(120 + i * 70).duration(400).springify()}
            style={styles.featureRow}
          >
            <View style={styles.featureIcon}>
              <Feather name={f.icon} size={15} color={Colors.dark.gold} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
            <Feather name="check" size={16} color={Colors.dark.positive} />
          </Animated.View>
        ))}
      </View>

      <View style={styles.plans}>
        {plans.map((plan, i) => {
          const isSelected = selected === plan.id;
          const card = (
            <AnimatedPressable
              key={plan.id}
              scaleDown={0.97}
              onPress={() => {
                Haptics.selectionAsync();
                setSelected(plan.id);
              }}
              style={[
                styles.planCard,
                isSelected && styles.planCardSelected,
              ]}
            >
              <View style={styles.planLeft}>
                <View style={styles.planLabelRow}>
                  <Text style={styles.planLabel}>{plan.label}</Text>
                  {plan.preferred && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>BEST VALUE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planNote}>{plan.note}</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
              <View
                style={[styles.radio, isSelected && styles.radioSelected]}
              >
                {isSelected && (
                  <Feather name="check" size={12} color="#000" />
                )}
              </View>
            </AnimatedPressable>
          );

          return plan.preferred ? (
            <Animated.View
              key={plan.id}
              entering={FadeInDown.delay(420).duration(420).springify()}
            >
              <Animated.View style={[styles.preferredFrame, preferredGlowStyle]}>
                {card}
              </Animated.View>
            </Animated.View>
          ) : (
            <Animated.View
              key={plan.id}
              entering={FadeInDown.delay(480 + i * 60).duration(420).springify()}
            >
              {card}
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={FadeInDown.delay(600).duration(420).springify()}>
        <AnimatedPressable
          scaleDown={0.97}
          onPress={handleContinue}
          disabled={busy}
          style={[styles.cta, busy && { opacity: 0.7 }]}
        >
          {busy ? (
            <ActivityIndicator color={Colors.dark.background} />
          ) : (
            <Text style={styles.ctaText}>
              Continue —{" "}
              {selected === "lifetime" ? pricing.lifetime : `${pricing.monthly}/mo`}
            </Text>
          )}
        </AnimatedPressable>

        <AnimatedPressable
          scaleDown={0.97}
          onPress={handleRestore}
          style={styles.restore}
        >
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </AnimatedPressable>

        <Text style={styles.finePrint}>
          {storeReady
            ? "Payment is charged to your Apple ID. Monthly renews automatically until canceled in Settings → Apple ID → Subscriptions at least 24h before the period ends. Lifetime is a one-time purchase."
            : "Store connection unavailable — purchases can't be completed right now."}
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingHorizontal: 22,
    gap: 22,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  features: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  plans: {
    gap: 12,
  },
  preferredFrame: {
    borderWidth: 2,
    borderRadius: 18,
    borderColor: Colors.dark.gold,
    shadowColor: Colors.dark.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planCardSelected: {
    backgroundColor: "#22200f",
  },
  planLeft: {
    flex: 1,
    gap: 3,
  },
  planLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planLabel: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  badge: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.6,
  },
  planNote: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  planRight: {
    alignItems: "flex-end",
    gap: 1,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  planPeriod: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.dark.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  cta: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 15,
    paddingVertical: 17,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  restore: {
    alignItems: "center",
    paddingVertical: 14,
  },
  restoreText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.gold,
  },
  finePrint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});
