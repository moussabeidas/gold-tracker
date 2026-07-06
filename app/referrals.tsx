import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useReferral } from "@/context/ReferralContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { shareMessage, REFERRAL_TARGET } from "@/lib/referral";
import { track } from "@/lib/analytics";

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const {
    inviteCode,
    referredCount,
    hasReferralPro,
    proUntil,
    claimReferral,
    redeemInviteCode,
    redeemedCode,
  } = useReferral();
  const { purchases } = usePortfolio();

  const [claimText, setClaimText] = useState("");
  const [redeemText, setRedeemText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track("referral_share");
    try {
      await Share.share({ message: shareMessage(inviteCode) });
    } catch {}
  };

  const handleCopy = async () => {
    Haptics.selectionAsync();
    await Clipboard.setStringAsync(inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleClaim = async () => {
    const result = await claimReferral(claimText);
    if (result === "ok") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setClaimText("");
      const next = referredCount + 1;
      Alert.alert(
        next >= REFERRAL_TARGET ? "Pro unlocked! 🏆" : "Referral counted! 🎉",
        next >= REFERRAL_TARGET
          ? "Ten friends joined — you've earned 6 months of Gold Pricer Pro, free."
          : `That's ${next} of ${REFERRAL_TARGET}. You've earned an extra portfolio slot.`
      );
    } else if (result === "duplicate") {
      Alert.alert("Already counted", "That friend's code has been used before.");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Invalid code",
        "That doesn't match an invite you sent. Ask your friend for the code shown after they redeem your invite."
      );
    }
  };

  const handleRedeem = async () => {
    if (purchases.length === 0) {
      Alert.alert(
        "Add gold first",
        "Add your first piece of gold to your portfolio, then redeem your friend's invite code."
      );
      return;
    }
    const token = await redeemInviteCode(redeemText);
    if (token === "server") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRedeemText("");
      Alert.alert(
        "You got an extra slot! 🎁",
        "Your friend has been credited automatically. Enjoy the extra room in your portfolio."
      );
    } else if (token) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRedeemText("");
      Alert.alert(
        "You got an extra slot! 🎁",
        `Send this code back to your friend so they get credit too:\n\n${token}`,
        [
          {
            text: "Copy code",
            onPress: () => Clipboard.setStringAsync(token).catch(() => {}),
          },
          { text: "Done", style: "cancel" },
        ]
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid code", "Check the 6-character invite code and try again.");
    }
  };

  const progress = Math.min(referredCount / REFERRAL_TARGET, 1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <AnimatedPressable scaleDown={0.9} onPress={() => router.back()} style={styles.closeButton}>
          <Feather name="chevron-down" size={22} color={Colors.dark.text} />
        </AnimatedPressable>
        <Text style={styles.title}>Invite & Earn</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={["rgba(255,215,0,0.16)", "rgba(255,215,0,0.04)"]}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.heroTitle}>Give gold, get gold</Text>
          <Text style={styles.heroBody}>
            Invite a friend — when they join and add their first piece of
            gold, you BOTH get an extra portfolio slot. Reach{" "}
            {REFERRAL_TARGET} friends and unlock 6 months of Pro, free.
          </Text>

          <View style={styles.codeRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.codeValue}>{inviteCode}</Text>
            </View>
            <AnimatedPressable scaleDown={0.92} style={styles.copyButton} onPress={handleCopy}>
              <Feather name={copied ? "check" : "copy"} size={18} color={Colors.dark.gold} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable scaleDown={0.97} style={styles.shareButton} onPress={handleShare}>
            <Feather name="share" size={16} color={Colors.dark.background} />
            <Text style={styles.shareText}>Share your invite</Text>
          </AnimatedPressable>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>
              {hasReferralPro ? "Pro reward active 🏆" : "Progress to free Pro"}
            </Text>
            <Text style={styles.progressCount}>
              {referredCount}/{REFERRAL_TARGET}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressHint}>
            {hasReferralPro
              ? `Pro is yours until ${new Date(proUntil).toLocaleDateString()}.`
              : referredCount === 0
                ? "Each verified friend = +1 portfolio slot for you."
                : `${REFERRAL_TARGET - referredCount} more to unlock 6 months of Pro.`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Friend joined? Enter their code</Text>
          <Text style={styles.cardHint}>
            After a friend redeems your invite, their app shows a short code —
            enter it here to collect your reward.
          </Text>
          <View style={styles.claimRow}>
            <TextInput
              style={styles.claimInput}
              value={claimText}
              onChangeText={setClaimText}
              placeholder="e.g. K7X-4QF2"
              placeholderTextColor={Colors.dark.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
            />
            <AnimatedPressable
              scaleDown={0.94}
              style={[styles.claimButton, !claimText.trim() && styles.claimButtonDisabled]}
              onPress={handleClaim}
              disabled={!claimText.trim()}
            >
              <Text style={styles.claimButtonText}>Claim</Text>
            </AnimatedPressable>
          </View>
        </View>

        {!redeemedCode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Were you invited?</Text>
            <Text style={styles.cardHint}>
              Enter your friend's 6-character invite code after adding your
              first gold piece — you'll get an extra slot too.
            </Text>
            <View style={styles.claimRow}>
              <TextInput
                style={styles.claimInput}
                value={redeemText}
                onChangeText={setRedeemText}
                placeholder="e.g. AB2CD3"
                placeholderTextColor={Colors.dark.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                returnKeyType="done"
              />
              <AnimatedPressable
                scaleDown={0.94}
                style={[styles.claimButton, !redeemText.trim() && styles.claimButtonDisabled]}
                onPress={handleRedeem}
                disabled={!redeemText.trim()}
              >
                <Text style={styles.claimButtonText}>Redeem</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
    paddingTop: 8,
  },
  hero: {
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.25)",
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  heroBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  codeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  codeBox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.textTertiary,
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 4,
  },
  copyButton: {
    width: 52,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  cardHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    lineHeight: 17,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressCount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    fontVariant: ["tabular-nums"],
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surface,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
  },
  progressHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  claimRow: {
    flexDirection: "row",
    gap: 10,
  },
  claimInput: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    letterSpacing: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  claimButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  claimButtonDisabled: {
    opacity: 0.4,
  },
  claimButtonText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
});
