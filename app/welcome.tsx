import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SpinningCoin } from "@/components/SpinningCoin";
import { useGoldPrice } from "@/context/GoldPriceContext";
import { useCurrency } from "@/context/CurrencyContext";
import {
  loadAlertPrefs,
  saveAlertPrefs,
  requestAlertPermission,
} from "@/lib/alerts";
import { track } from "@/lib/analytics";
import {
  DemoScan,
  DemoAlerts,
  DemoWidget,
  DemoSpark,
} from "@/components/OnboardingDemos";

export const ONBOARDING_KEY = "onboarding_v1_done";

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}

type Step = 0 | 1 | 2 | 3;
const LAST_STEP: Step = 3;

function Point({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.pointRow}>
      <View style={styles.pointIcon}>
        <Feather name={icon as any} size={15} color={Colors.dark.gold} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

/**
 * First-launch intro: what the app does and the three actions that make it
 * useful (add gold, enable alerts, add the widget). Shown once; replayable
 * from Profile.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { anchorPrice } = useGoldPrice();
  const { fmt } = useCurrency();
  const [step, setStep] = useState<Step>(0);
  const [alertsOn, setAlertsOn] = useState(false);

  const goTo = (next: Step) => {
    Haptics.selectionAsync();
    track("onboarding_step", { step: next });
    setStep(next);
  };

  const finish = async (action: "add_gold" | "explore") => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track("onboarding_done", { action, alerts_enabled: alertsOn });
    await markOnboardingDone();
    router.back();
    if (action === "add_gold") {
      setTimeout(() => router.push("/add-purchase"), 350);
    }
  };

  const enableAlerts = async () => {
    Haptics.selectionAsync();
    const ok = await requestAlertPermission();
    if (!ok) {
      Alert.alert(
        "Notifications Off",
        "Enable notifications for Gold Pricer in Settings to get price alerts."
      );
      return;
    }
    const prefs = await loadAlertPrefs();
    await saveAlertPrefs({ ...prefs, bigMoves: true, dailyBrief: true });
    setAlertsOn(true);
    track("onboarding_alerts_enabled");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const livePrice = anchorPrice > 0 ? fmt(anchorPrice) : null;
  const compactPrice = anchorPrice > 0 ? fmt(Math.round(anchorPrice)) : null;

  const pages = [
    // 0 — welcome
    <>
      <SpinningCoin size={84} periodMs={5000} />
      <Text style={styles.eyebrow}>WELCOME TO GOLD PRICER</Text>
      <Text style={styles.title}>Your gold, priced live</Text>
      {livePrice ? (
        <View style={styles.priceChip}>
          <View style={styles.liveDot} />
          <Text style={styles.priceChipText}>{livePrice} / oz right now</Text>
        </View>
      ) : null}
      <DemoSpark />
      <Text style={styles.body}>
        Live spot prices, your portfolio's real value, and alerts when the
        market moves — in your currency.
      </Text>
    </>,
    // 1 — add gold (photo scan demo)
    <>
      <Text style={styles.eyebrow}>STEP 1</Text>
      <Text style={styles.title}>Snap it. We read it.</Text>
      <DemoScan />
      <Text style={styles.body}>
        Point your camera at a bar or coin — the stamps are read on your
        phone and the details fill themselves. Or type them in; jewelry
        works too.
      </Text>
      <View style={styles.points}>
        <Point icon="trending-up" text="See what it's worth, updated live" />
        <Point icon="dollar-sign" text="Track profit vs. what you paid" />
      </View>
    </>,
    // 2 — alerts (notification demo)
    <>
      <Text style={styles.eyebrow}>STEP 2</Text>
      <Text style={styles.title}>Never miss a move</Text>
      <DemoAlerts priceText={compactPrice} />
      <Text style={styles.body}>
        A ping when gold rallies or drops, a morning brief with price and
        news, and your own price targets if you want them.
      </Text>
      {alertsOn ? (
        <View style={styles.enabledChip}>
          <Feather name="check-circle" size={16} color={Colors.dark.positive} />
          <Text style={styles.enabledText}>Alerts are on</Text>
        </View>
      ) : (
        <AnimatedPressable
          scaleDown={0.97}
          style={styles.secondaryCta}
          onPress={enableAlerts}
        >
          <Feather name="bell" size={15} color={Colors.dark.gold} />
          <Text style={styles.secondaryCtaText}>Turn on alerts</Text>
        </AnimatedPressable>
      )}
    </>,
    // 3 — widget demo + go
    <>
      <Text style={styles.eyebrow}>STEP 3</Text>
      <Text style={styles.title}>Gold on your Home Screen</Text>
      <DemoWidget
        priceText={compactPrice}
        changeText={"+1.8% today"}
      />
      <Text style={styles.body}>
        Touch and hold your Home Screen, tap <Text style={styles.bold}>+</Text>,
        and search <Text style={styles.bold}>Gold Pricer</Text>. Live price
        and your portfolio, one glance away.
      </Text>
    </>,
  ];

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive]}
          />
        ))}
      </View>

      <Animated.ScrollView
        key={step}
        entering={step === 0 ? FadeIn.duration(400) : FadeInDown.duration(350).springify()}
        style={{ flex: 1 }}
        contentContainerStyle={styles.card}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {pages[step]}
      </Animated.ScrollView>

      <View style={styles.footer}>
        {step < LAST_STEP ? (
          <AnimatedPressable
            scaleDown={0.97}
            style={styles.cta}
            onPress={() => goTo((step + 1) as Step)}
          >
            <Text style={styles.ctaText}>Continue</Text>
            <Feather
              name="arrow-right"
              size={16}
              color={Colors.dark.background}
            />
          </AnimatedPressable>
        ) : (
          <>
            <AnimatedPressable
              scaleDown={0.97}
              style={styles.cta}
              onPress={() => finish("add_gold")}
            >
              <Feather name="plus" size={16} color={Colors.dark.background} />
              <Text style={styles.ctaText}>Add my first gold</Text>
            </AnimatedPressable>
            <AnimatedPressable
              scaleDown={0.97}
              style={styles.later}
              onPress={() => finish("explore")}
            >
              <Text style={styles.laterText}>Explore first</Text>
            </AnimatedPressable>
          </>
        )}
        {step < LAST_STEP && (
          <AnimatedPressable
            scaleDown={0.97}
            style={styles.later}
            onPress={() => finish("explore")}
          >
            <Text style={styles.laterText}>Skip</Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginBottom: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: {
    backgroundColor: Colors.dark.gold,
    width: 20,
  },
  card: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  bigIcon: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 27,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 15.5,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  bold: {
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  priceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.22)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.dark.positive,
  },
  priceChipText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    fontVariant: ["tabular-nums"],
  },
  points: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,215,0,0.05)",
    borderRadius: 16,
    padding: 16,
    gap: 13,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  pointIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  enabledChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.positiveBackground,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  enabledText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.positive,
  },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  secondaryCtaText: {
    fontSize: 15.5,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  footer: {
    gap: 4,
    paddingTop: 12,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 16.5,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  later: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  laterText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
});
