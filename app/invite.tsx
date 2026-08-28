import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Share, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/lib/auth";
import { useReferral } from "@/context/ReferralContext";
import { storePendingInvite } from "@/context/ReferralContext";
import { thanksMessage, REFERRAL_TARGET } from "@/lib/referral";
import { track } from "@/lib/analytics";

type Outcome =
  | { kind: "working" }
  | { kind: "redeemed-server" }
  | { kind: "redeemed-offline"; token: string }
  | { kind: "saved-for-signin" }
  | { kind: "credited"; count: number }
  | { kind: "duplicate" }
  | { kind: "invalid" };

/**
 * Landing route for invite links: goldtracker://invite?c=CODE applies a
 * friend's invite; goldtracker://invite?t=TOKEN credits the referrer.
 */
export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ c?: string; t?: string }>();
  const { isAuthenticated } = useAuth();
  const { redeemInviteCode, claimReferral, referredCount } = useReferral();
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
      if (result === "server") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOutcome({ kind: "redeemed-server" });
      } else if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOutcome({ kind: "redeemed-offline", token: result });
      } else {
        setOutcome({ kind: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendThanks = async (token: string) => {
    Haptics.selectionAsync();
    await Share.share({ message: thanksMessage(token) }).catch(() => {});
    router.back();
  };

  const content = (() => {
    switch (outcome.kind) {
      case "working":
        return (
          <>
            <ActivityIndicator color={Colors.dark.gold} size="large" />
            <Text style={styles.title}>Checking your invite…</Text>
          </>
        );
      case "redeemed-server":
        return (
          <>
            <Feather name="check-circle" size={44} color={Colors.dark.positive} />
            <Text style={styles.title}>Invite applied!</Text>
            <Text style={styles.body}>
              You've unlocked an extra portfolio slot, and your friend's
              referral was counted automatically. Add your first piece of
              gold to get going.
            </Text>
          </>
        );
      case "redeemed-offline":
        return (
          <>
            <Feather name="check-circle" size={44} color={Colors.dark.positive} />
            <Text style={styles.title}>Invite applied!</Text>
            <Text style={styles.body}>
              You've unlocked an extra portfolio slot. One last tap: send
              your friend their credit — it's a prefilled message.
            </Text>
            <AnimatedPressable
              scaleDown={0.97}
              style={styles.cta}
              onPress={() => sendThanks(outcome.token)}
            >
              <Feather name="send" size={16} color={Colors.dark.background} />
              <Text style={styles.ctaText}>Send their credit</Text>
            </AnimatedPressable>
          </>
        );
      case "saved-for-signin":
        return (
          <>
            <Feather name="user-check" size={44} color={Colors.dark.gold} />
            <Text style={styles.title}>Invite saved</Text>
            <Text style={styles.body}>
              Sign in with Apple on the Profile tab and your friend's invite
              applies automatically — nothing to type.
            </Text>
          </>
        );
      case "credited":
        return (
          <>
            <Feather name="award" size={44} color={Colors.dark.gold} />
            <Text style={styles.title}>Referral counted! 🎉</Text>
            <Text style={styles.body}>
              {`That's ${Math.min(outcome.count, REFERRAL_TARGET)} of ${REFERRAL_TARGET} toward 6 months of Pro.`}
            </Text>
          </>
        );
      case "duplicate":
        return (
          <>
            <Feather name="info" size={44} color={Colors.dark.textSecondary} />
            <Text style={styles.title}>Already counted</Text>
            <Text style={styles.body}>
              This friend's referral was credited earlier — it only counts
              once per person.
            </Text>
          </>
        );
      case "invalid":
        return (
          <>
            <Feather name="x-circle" size={44} color={Colors.dark.negative} />
            <Text style={styles.title}>Link didn't work</Text>
            <Text style={styles.body}>
              This invite link looks incomplete or was made for someone
              else. Ask your friend to share it again from their Referrals
              screen.
            </Text>
          </>
        );
    }
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.card}>{content}</View>
      <AnimatedPressable
        scaleDown={0.97}
        style={styles.done}
        onPress={() => {
          Haptics.selectionAsync();
          router.back();
        }}
      >
        <Text style={styles.doneText}>Done</Text>
      </AnimatedPressable>
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
    marginTop: 32,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.15)",
  },
  title: {
    fontSize: 21,
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
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  done: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  doneText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.gold,
  },
});
