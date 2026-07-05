import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const FEATURES = [
  {
    icon: "trending-up" as const,
    title: "Live Price Tracking",
    subtitle: "Real-time XAU/USD with interactive charts",
  },
  {
    icon: "camera" as const,
    title: "Photo Capture",
    subtitle: "Photograph your bars and coins for your records",
  },
  {
    icon: "briefcase" as const,
    title: "Portfolio Analytics",
    subtitle: "Track total weight, cost basis, and current value",
  },
];

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const isIOS = Platform.OS === "ios";
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (isIOS) {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, [isIOS]);

  // Slow breathing glow behind the seal
  const glow = useSharedValue(0.45);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.92 + glow.value * 0.16 }],
  }));

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    login();
  };

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
      <Animated.View
        entering={FadeInDown.duration(500).springify()}
        style={styles.topSection}
      >
        <View style={styles.iconRing}>
          <Animated.View style={[styles.iconGlow, glowStyle]} />
          <View style={styles.iconInner}>
            {isIOS ? (
              <SymbolView name="seal.fill" tintColor={Colors.dark.gold} size={52} />
            ) : (
              <Feather name="circle" size={52} color={Colors.dark.gold} />
            )}
          </View>
        </View>

        <Text style={styles.appName}>Gold Pricer</Text>
        <Text style={styles.tagline}>Your personal gold portfolio tracker</Text>
      </Animated.View>

      <View style={styles.middleSection}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f.title}
            entering={FadeInDown.delay(150 + i * 110).duration(450).springify()}
            style={styles.featureRow}
          >
            <View style={styles.featureIcon}>
              <Feather name={f.icon} size={18} color={Colors.dark.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View
        entering={FadeInUp.delay(450).duration(450).springify()}
        style={styles.bottomSection}
      >
        {isLoading ? (
          <View style={styles.loadingButton}>
            <ActivityIndicator color={Colors.dark.gold} />
          </View>
        ) : appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={14}
            style={styles.appleButton}
            onPress={handleLogin}
          />
        ) : (
          <AnimatedPressable
            scaleDown={0.97}
            style={styles.loginButton}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Continue</Text>
          </AnimatedPressable>
        )}

        <Text style={styles.disclaimer}>
          Your portfolio is stored privately on this device.{"\n"}
          No account details ever leave your phone.
        </Text>
      </Animated.View>
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
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 55,
    backgroundColor: "rgba(255,215,0,0.14)",
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
  appleButton: {
    height: 54,
    width: "100%",
  },
  loadingButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
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
