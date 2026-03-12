import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const isIOS = Platform.OS === "ios";

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop:
            Platform.OS === "web" ? insets.top + 67 : insets.top + 20,
          paddingBottom:
            Platform.OS === "web" ? insets.bottom + 34 : insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.topSection}>
        <View style={styles.iconRing}>
          <View style={styles.iconInner}>
            {isIOS ? (
              <SymbolView name="seal.fill" tintColor={Colors.dark.gold} size={52} />
            ) : (
              <Feather name="circle" size={52} color={Colors.dark.gold} />
            )}
          </View>
        </View>

        <Text style={styles.appName}>Gold</Text>
        <Text style={styles.tagline}>Your personal gold portfolio tracker</Text>
      </View>

      <View style={styles.middleSection}>
        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Feather name="trending-up" size={18} color={Colors.dark.gold} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Live Price Tracking</Text>
            <Text style={styles.featureSubtitle}>
              Real-time XAU/USD with interactive charts
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Feather name="camera" size={18} color={Colors.dark.gold} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Photo Capture</Text>
            <Text style={styles.featureSubtitle}>
              Photograph your bars and coins for your records
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Feather name="briefcase" size={18} color={Colors.dark.gold} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Portfolio Analytics</Text>
            <Text style={styles.featureSubtitle}>
              Track total weight, cost basis, and current value
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            pressed && styles.loginButtonPressed,
          ]}
          onPress={login}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.dark.background} />
          ) : (
            <Text style={styles.loginButtonText}>Sign In to Continue</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          Your portfolio data is stored securely on your device and linked to
          your account.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  iconRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,215,0,0.06)",
  },
  iconInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  middleSection: {
    gap: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  featureSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 19,
  },
  bottomSection: {
    gap: 14,
    paddingBottom: 16,
  },
  loginButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    textAlign: "center",
    lineHeight: 17,
  },
});
