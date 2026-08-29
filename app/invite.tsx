import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Share, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SpinningCoin } from "@/components/SpinningCoin";
import { useAuth } from "@/lib/auth";
import { useReferral, storePendingInvite } from "@/context/ReferralContext";
import { shareMessage, thanksMessage, REFERRAL_TARGET } from "@/lib/referral";
import { track } from "@/lib/analytics";

type Outcome =
  | { kind: "working" }
  | { kind: "redeemed"; token: string | null } // token set on the offline path
  | { kind: "saved-for-signin" }
  | { kind: "credited"; count: number }
  | { kind: "duplicate" }
  | { kind: "self" }
  | { kind: "invalid" };

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Feather name={icon as any} size={15} color={Colors.dark.gold} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
      <Feather name="check" size={16} color={Colors.dark.positive} />
    </View>
  );
}

/**
 * Landing route for invite links: goldtracker://invite?c=CODE applies a
 * friend's invite; goldtracker://invite?t=TOKEN credits the referrer.
 */
export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ c?: string; t?: string }>();
  const { isAuthenticated } = useAuth();
  const { redeemInviteCode, claimReferral, referredCount, inviteCode } =
    useReferral();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "working" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = typeof params.c === "string" ? params.c : "";
      const token = typeof params.t === "string" ? params.t : "";
      track("referral_link_open", { kind: token ? "thanks" : "invite" });

      if (token) {
        const result = await claimReferral(token);
        if (cancelled) return;
        if (result === "ok") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setOutcome({ kind: "credited", count: referredCount + 1 });
        } else {
          setOutcome({ kind: result === "duplicate" ? "duplicate" : "invalid" });
        }
        return;
      }

      if (!code) {
        setOutcome({ kind: "invalid" });
        return;
      }
      if (!isAuthenticated) {
        await storePendingInvite(code);
        if (!cancelled) setOutcome({ kind: "saved-for-signin" });
        return;
      }
      const result = await redeemInviteCode(code);
      if (cancelled) return;
      if (result === "self") {
        setOutcome({ kind: "self" });
      } else if (result === "server") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOutcome({ kind: "redeemed", token: null });
      } else if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOutcome({ kind: "redeemed", token: result });
      } else {
        setOutcome({ kind: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const primary = (label: string, icon: string, onPress: () => void) => (
    <AnimatedPressable scaleDown={0.97} style={styles.cta} onPress={onPress}>
      <Feather name={icon as any} size={16} color={Colors.dark.background} />
      <Text style={styles.ctaText}>{label}</Text>
    </AnimatedPressable>
  );

  const content = (() => {
    switch (outcome.kind) {
      case "working":
        return (
          <>
            <SpinningCoin size={88} periodMs={2500} />
            <Text style={styles.title}>Opening your invite…</Text>
            <ActivityIndicator color={Colors.dark.gold} />
          </>
        );
      case "redeemed":
        return (
          <>
            <SpinningCoin size={88} periodMs={6000} />
            <Text style={styles.eyebrow}>A FRIEND INVITED YOU</Text>
            <Text style={styles.title}>Welcome to Gold Pricer 🎉</Text>
            <View style={styles.benefits}>
              <Benefit icon="briefcase" text="Extra portfolio slot unlocked" />
              <Benefit icon="award" text="Your friend gets credit toward Pro" />
              <Benefit icon="zap" text="Live gold price, ready to go" />
            </View>
            {outcome.token ? (
              <>
                <Text style={styles.body}>
                  One tap left: send your friend their credit — the message is
                  ready to go.
                </Text>
                {primary("Send their credit", "send", async () => {
                  Haptics.selectionAsync();
                  await Share.share({
                    message: thanksMessage(outcome.token!),
                  }).catch(() => {});
                  router.back();
                })}
              </>
            ) : (
              primary("Start tracking gold", "arrow-right", close)
            )}
          </>
        );
      case "saved-for-signin":
        return (
          <>
            <SpinningCoin size={88} periodMs={6000} />
            <Text style={styles.eyebrow}>A FRIEND INVITED YOU</Text>
            <Text style={styles.title}>Your bonus is waiting</Text>
            <Text style={styles.body}>
              Sign in with Apple and your friend's invite applies by itself —
              an extra portfolio slot, nothing to type.
            </Text>
            {primary("Sign in to claim it", "user", () => {
              Haptics.selectionAsync();
              router.back();
              router.push("/(tabs)/profile");
            })}
          </>
        );
      case "credited":
        return (
          <>
            <SpinningCoin size={88} periodMs={6000} />
            <Text style={styles.eyebrow}>REFERRAL COUNTED</Text>
            <Text style={styles.title}>
              {`That's ${Math.min(outcome.count, REFERRAL_TARGET)} of ${REFERRAL_TARGET} 🎉`}
            </Text>
            <Text style={styles.body}>
              Your friend joined with your invite. Reach {REFERRAL_TARGET} and
              you get 6 months of Pro, on the house.
            </Text>
            {primary("See my referrals", "award", () => {
              Haptics.selectionAsync();
              router.back();
              router.push("/referrals");
            })}
          </>
        );
      case "self":
        return (
          <>
            <SpinningCoin size={88} periodMs={6000} />
            <Text style={styles.title}>That's your own link 😄</Text>
            <Text style={styles.body}>
              Send it to a friend instead — when they join, you both get an
              extra portfolio slot, and {REFERRAL_TARGET} friends earn you 6
              months of Pro.
            </Text>
            {primary("Share it with a friend", "share", async () => {
              Haptics.selectionAsync();
              await Share.share({ message: shareMessage(inviteCode) }).catch(
                () => {}
              );
              router.back();
            })}
          </>
        );
      case "duplicate":
        return (
          <>
            <Feather name="info" size={40} color={Colors.dark.textSecondary} />
            <Text style={styles.title}>Already counted</Text>
            <Text style={styles.body}>
              This friend's referral was credited earlier — each friend counts
              once.
            </Text>
            {primary("See my referrals", "award", () => {
              Haptics.selectionAsync();
              router.back();
              router.push("/referrals");
            })}
          </>
        );
      case "invalid":
        return (
          <>
            <Feather name="x-circle" size={40} color={Colors.dark.negative} />
            <Text style={styles.title}>Link didn't work</Text>
            <Text style={styles.body}>
              This invite link looks incomplete. Ask your friend to share it
              again from their Referrals screen.
            </Text>
            {primary("Continue to the app", "arrow-right", close)}
          </>
        );
    }
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Animated.View
        entering={FadeInDown.duration(400).springify()}
        style={styles.card}
      >
        {content}
      </Animated.View>
      {outcome.kind !== "working" && (
        <AnimatedPressable scaleDown={0.97} style={styles.later} onPress={close}>
          <Text style={styles.laterText}>Not now</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
  },
  card: {
    marginTop: 24,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.18)",
  },
  eyebrow: {
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  benefits: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,215,0,0.05)",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    marginTop: 6,
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 15,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  later: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  laterText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
});
