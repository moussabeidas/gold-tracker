import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { FocusReveal } from "@/components/FocusReveal";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { usePortfolio } from "@/context/PortfolioContext";
import { useReferral } from "@/context/ReferralContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { LoginScreen } from "@/components/LoginScreen";
import { REFERRAL_TARGET } from "@/lib/referral";

function MenuRow({
  icon,
  label,
  value,
  onPress,
  danger,
  isLast,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        !isLast && styles.menuRowBordered,
        pressed && styles.menuRowPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: danger ? "rgba(255,69,58,0.12)" : Colors.dark.goldFaint },
        ]}
      >
        <Feather
          name={icon as any}
          size={16}
          color={danger ? Colors.dark.negative : Colors.dark.gold}
        />
      </View>
      <Text
        style={[
          styles.menuLabel,
          danger && { color: Colors.dark.negative },
        ]}
      >
        {label}
      </Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      {!danger && onPress ? (
        <Feather name="chevron-right" size={16} color={Colors.dark.textTertiary} />
      ) : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, deleteAccount } = useAuth();
  const { purchases, totalWeightGrams, totalInvested } = usePortfolio();
  const { isPro, subscription, revertToFree } = useSubscription();
  const { referredCount, hasReferralPro } = useReferral();

  const planLabel = hasReferralPro
    ? "Pro · Referral"
    : subscription.planId === "lifetime"
      ? "Pro · Lifetime"
      : subscription.planId === "tracker_monthly"
        ? "Pro · Monthly"
        : subscription.planId === "tracker_annual"
          ? "Pro · Annual"
          : "Standard";

  const handleManagePro = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Cancel Gold Pricer Pro?",
      "Important: canceling does not guarantee a refund for amounts already " +
        "paid.\n\n• Monthly subscriptions must also be canceled with Apple in " +
        "Settings → Apple ID → Subscriptions, or billing continues.\n• For " +
        "refund requests, use Apple's reportaproblem.apple.com.\n\nReverting " +
        "here switches this device back to the Standard tier immediately.",
      [
        { text: "Keep Pro", style: "cancel" },
        {
          text: "Manage Apple Subscription",
          onPress: () =>
            Linking.openURL("https://apps.apple.com/account/subscriptions").catch(
              () => {}
            ),
        },
        {
          text: "Revert to Standard",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            revertToFree();
          },
        },
      ]
    );
  };

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  const topPad =
    Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName ?? user.email ?? "User";

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : (user.firstName?.[0] ?? user.email?.[0] ?? "U").toUpperCase();

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Account?",
      "This permanently deletes your account and all data:\n\n\u2022 Your " +
        "portfolio on this device (cannot be recovered)\n\u2022 Your account, " +
        "referral history, and usage data on our server\n\nActive Apple " +
        "subscriptions are NOT canceled by this \u2014 manage those in " +
        "Settings \u2192 Apple ID \u2192 Subscriptions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "There is no undo. Your portfolio records will be gone.",
              [
                { text: "Keep My Account", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    deleteAccount();
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          // Native tab bar floats over content on iOS — pad well past it so
          // the last row (Delete Account) can scroll fully into view.
          paddingBottom:
            Platform.OS === "web"
              ? insets.bottom + 34 + 84
              : insets.bottom + 108,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <FocusReveal offset={12}>
        <Text style={styles.pageTitle}>Profile</Text>
      </FocusReveal>

      <FocusReveal delay={60} style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {user.profileImageUrl ? (
            <Image
              source={{ uri: user.profileImageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          {user.email ? (
            <Text style={styles.profileEmail}>{user.email}</Text>
          ) : null}
        </View>
      </FocusReveal>

      <FocusReveal delay={130} style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{purchases.length}</Text>
          <Text style={styles.statLabel}>Holdings</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {totalWeightGrams.toFixed(1)}g
          </Text>
          <Text style={styles.statLabel}>Total Weight</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            ${(totalInvested / 1000).toFixed(1)}K
          </Text>
          <Text style={styles.statLabel}>Invested</Text>
        </View>
      </FocusReveal>

      <FocusReveal delay={180} style={styles.menuSection}>
        <Text style={styles.sectionHeader}>Membership</Text>
        <View style={styles.menuCard}>
          <View style={[styles.menuRow, styles.menuRowBordered]}>
            <View
              style={[
                styles.menuIcon,
                { backgroundColor: Colors.dark.goldFaint },
              ]}
            >
              <Feather
                name={isPro ? "award" : "user"}
                size={16}
                color={Colors.dark.gold}
              />
            </View>
            <Text style={styles.menuLabel}>Plan</Text>
            <View style={[styles.planBadge, !isPro && styles.planBadgeMuted]}>
              <Text
                style={[styles.planBadgeText, !isPro && styles.planBadgeTextMuted]}
              >
                {planLabel}
              </Text>
            </View>
          </View>
          {isPro ? (
            <MenuRow
              icon="slash"
              label="Manage or Cancel Pro"
              onPress={handleManagePro}
              isLast
            />
          ) : (
            <MenuRow
              icon="arrow-up-circle"
              label="Upgrade to Pro"
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/paywall");
              }}
              isLast
            />
          )}
        </View>
      </FocusReveal>

      <FocusReveal delay={205} style={styles.menuSection}>
        <Text style={styles.sectionHeader}>Invite & Earn</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="gift"
            label="Invite friends, earn Pro"
            value={
              referredCount > 0
                ? `${referredCount}/${REFERRAL_TARGET}`
                : "+1 slot each"
            }
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/referrals");
            }}
            isLast
          />
        </View>
      </FocusReveal>

      <FocusReveal delay={220} style={styles.menuSection}>
        <Text style={styles.sectionHeader}>Widgets & Alerts</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="grid"
            label="Widgets"
            value="Home & Lock Screen"
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/widgets-settings");
            }}
          />
          <MenuRow
            icon="bell"
            label="Price Alerts"
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/alerts-settings");
            }}
            isLast
          />
        </View>
      </FocusReveal>

      <FocusReveal delay={230} style={styles.menuSection}>
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="mail"
            label="Email"
            value={user.email ?? "—"}
          />
          <MenuRow
            icon="user"
            label="Display Name"
            value={displayName}
            isLast
          />
        </View>
      </FocusReveal>

      <FocusReveal delay={260} style={styles.menuSection}>
        <Text style={styles.sectionHeader}>Data</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="download"
            label="Export Portfolio"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert("Coming Soon", "Export feature coming soon.");
            }}
          />
          <MenuRow
            icon="refresh-cw"
            label="Sync"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert("Synced", "Your portfolio is up to date.");
            }}
            isLast
          />
        </View>
      </FocusReveal>

      <FocusReveal delay={320} style={styles.menuSection}>
        <View style={styles.menuCard}>
          <MenuRow
            icon="log-out"
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
          <MenuRow
            icon="trash-2"
            label="Delete Account"
            onPress={handleDeleteAccount}
            danger
            isLast
          />
        </View>
      </FocusReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  profileCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {},
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  menuSection: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  menuRowPressed: {
    opacity: 0.7,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  planBadge: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeMuted: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  planBadgeTextMuted: {
    color: Colors.dark.textSecondary,
  },
  menuValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    maxWidth: 160,
    textAlign: "right",
  },
});
