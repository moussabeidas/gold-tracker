import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useSubscription, type PlanId } from "@/context/SubscriptionContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";

interface Plan {
  id: PlanId;
  label: string;
  price: string;
  period: string;
  perMonth: string;
  badge?: string;
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    id: "tracker_annual",
    label: "Annual",
    price: "$29.99",
    period: "per year",
    perMonth: "$2.50 / mo",
    badge: "Best Value · 50% off",
    highlight: true,
  },
  {
    id: "tracker_monthly",
    label: "Monthly",
    price: "$4.99",
    period: "per month",
    perMonth: "",
    highlight: false,
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: "$79.99",
    period: "one-time",
    perMonth: "Pay once, own forever",
    highlight: false,
  },
];

const FEATURES = [
  { icon: "layers", text: "Unlimited portfolio holdings" },
  { icon: "bell", text: "Gold price alerts" },
  { icon: "download", text: "Export to CSV & PDF" },
  { icon: "bar-chart-2", text: "Advanced gain/loss analytics" },
  { icon: "refresh-cw", text: "Auto-sync across devices" },
  { icon: "shield", text: "Priority support" },
];

interface Props {
  onDismiss: () => void;
}

export function PaywallScreen({ onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { subscribe } = useSubscription();
  const [selected, setSelected] = useState<PlanId>("tracker_annual");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    // Simulate in-app purchase flow (replace with real StoreKit/RevenueCat)
    await new Promise((r) => setTimeout(r, 900));
    await subscribe(selected);
    setLoading(false);

    const plan = PLANS.find((p) => p.id === selected);
    Alert.alert(
      "Welcome to Gold Tracker Pro! ✦",
      `Your ${plan?.label} plan is now active. Enjoy unlimited portfolio holdings and all Pro features.`,
      [{ text: "Let's go", onPress: onDismiss }]
    );
  };

  const topPad =
    Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Close */}
      <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={12}>
        <Feather name="x" size={20} color={Colors.dark.textSecondary} />
      </Pressable>

      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.hero}>
        <View style={styles.goldBadge}>
          <Text style={styles.goldBadgeIcon}>✦</Text>
        </View>
        <Text style={styles.heroTitle}>Upgrade to Pro</Text>
        <Text style={styles.heroSubtitle}>
          You've filled your 2 free slots.{"\n"}Unlock unlimited holdings and every Pro feature.
        </Text>
      </Animated.View>

      {/* Features */}
      <Animated.View entering={FadeInDown.delay(80).duration(400).springify()} style={styles.featureList}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Feather name={f.icon as any} size={15} color={Colors.dark.gold} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Plan selector */}
      <Animated.View entering={FadeInDown.delay(160).duration(400).springify()} style={styles.planList}>
        {PLANS.map((plan) => (
          <AnimatedPressable
            key={plan.id}
            scaleDown={0.97}
            onPress={() => {
              Haptics.selectionAsync();
              setSelected(plan.id);
            }}
            style={[
              styles.planCard,
              selected === plan.id && styles.planCardSelected,
              plan.highlight && selected === plan.id && styles.planCardHighlight,
            ]}
          >
            {plan.badge ? (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            ) : null}

            <View style={styles.planRow}>
              <View style={styles.planLeft}>
                <View
                  style={[
                    styles.radio,
                    selected === plan.id && styles.radioSelected,
                  ]}
                >
                  {selected === plan.id && <View style={styles.radioDot} />}
                </View>
                <View>
                  <Text
                    style={[
                      styles.planLabel,
                      selected === plan.id && styles.planLabelSelected,
                    ]}
                  >
                    {plan.label}
                  </Text>
                  {plan.perMonth ? (
                    <Text style={styles.planPerMonth}>{plan.perMonth}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.planRight}>
                <Text
                  style={[
                    styles.planPrice,
                    selected === plan.id && styles.planPriceSelected,
                  ]}
                >
                  {plan.price}
                </Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </View>
          </AnimatedPressable>
        ))}
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(200).duration(400).springify()} style={styles.ctaSection}>
        <AnimatedPressable
          scaleDown={0.97}
          onPress={handleSubscribe}
          style={[styles.ctaButton, loading && styles.ctaDisabled]}
          disabled={loading}
        >
          <Text style={styles.ctaText}>
            {loading ? "Processing…" : "Start Pro Now"}
          </Text>
        </AnimatedPressable>

        <Pressable onPress={onDismiss} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore Purchase</Text>
        </Pressable>

        <Text style={styles.legal}>
          Subscriptions auto-renew until cancelled. Cancel anytime in your
          device settings. By continuing you agree to our Terms & Privacy
          Policy.
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
    paddingHorizontal: 20,
    gap: 20,
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  goldBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  goldBadgeIcon: {
    fontSize: 30,
    color: Colors.dark.gold,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  featureList: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
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
  planList: {
    gap: 10,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceElevated,
    padding: 16,
    overflow: "hidden",
  },
  planCardSelected: {
    borderColor: Colors.dark.gold,
  },
  planCardHighlight: {
    backgroundColor: "rgba(255,215,0,0.06)",
  },
  planBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  planBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: Colors.dark.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.gold,
  },
  planLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  planLabelSelected: {
    color: Colors.dark.text,
  },
  planPerMonth: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  planRight: {
    alignItems: "flex-end",
  },
  planPrice: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.textSecondary,
  },
  planPriceSelected: {
    color: Colors.dark.gold,
  },
  planPeriod: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  ctaSection: {
    gap: 12,
  },
  ctaButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  restoreText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});
