import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import Colors from "@/constants/colors";
import { useGoldPrice } from "@/context/GoldPriceContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const NOTIFY_KEY = "@gold_marketplace_notify";

const FEATURES = [
  {
    icon: "tag" as const,
    title: "List your gold for sale",
    body: "Publish bars and coins from your portfolio — set the weight, purity, photos, and your asking price.",
  },
  {
    icon: "search" as const,
    title: "Browse listings",
    body: "Discover gold offered by other collectors, priced against the live spot rate.",
  },
  {
    icon: "shield" as const,
    title: "Protected transactions",
    body: "Funds are held safely until the buyer confirms the piece arrived as described.",
  },
  {
    icon: "send" as const,
    title: "Insured delivery",
    body: "Fully insured shipping or verified in-person handoff — your choice.",
  },
];

function PreviewListing({
  name,
  weight,
  premiumPct,
  index,
}: {
  name: string;
  weight: string;
  premiumPct: number;
  index: number;
}) {
  const { pricePerGram } = useGoldPrice();
  const grams = parseFloat(weight);
  const price = grams * pricePerGram * (1 + premiumPct / 100);
  const isIOS = Platform.OS === "ios";

  return (
    <Animated.View
      entering={FadeInDown.delay(350 + index * 80).duration(400).springify()}
      style={styles.listingCard}
    >
      <View style={styles.listingImage}>
        {isIOS ? (
          <SymbolView name="seal.fill" tintColor={Colors.dark.goldDim} size={28} />
        ) : (
          <Feather name="circle" size={28} color={Colors.dark.goldDim} />
        )}
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.listingMeta}>
          {weight}g · +{premiumPct.toFixed(1)}% over spot
        </Text>
      </View>
      <View style={styles.listingRight}>
        <Text style={styles.listingPrice}>
          $
          {price.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </Text>
        <View style={styles.lockBadge}>
          <Feather name="lock" size={10} color={Colors.dark.textTertiary} />
          <Text style={styles.lockText}>Preview</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const [notified, setNotified] = useState(false);
  const isIOS = Platform.OS === "ios";

  useEffect(() => {
    AsyncStorage.getItem(NOTIFY_KEY).then((v) => setNotified(v === "1"));
  }, []);

  // Slow breathing glow behind the hero icon
  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.5, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.9 + glow.value * 0.2 }],
  }));

  const handleNotify = async () => {
    if (notified) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotified(true);
    await AsyncStorage.setItem(NOTIFY_KEY, "1");
  };

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom:
            Platform.OS === "web"
              ? insets.bottom + 34 + 84
              : insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        entering={FadeInDown.duration(350).springify()}
        style={styles.header}
      >
        <Text style={styles.pageTitle}>Marketplace</Text>
        <View style={styles.comingSoonPill}>
          <Text style={styles.comingSoonText}>COMING SOON</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400).springify()}>
        <LinearGradient
          colors={["#241C05", "#191919", Colors.dark.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIconWrap}>
            <Animated.View style={[styles.heroGlow, glowStyle]} />
            {isIOS ? (
              <SymbolView
                name="storefront.fill"
                tintColor={Colors.dark.gold}
                size={40}
              />
            ) : (
              <Feather name="shopping-bag" size={36} color={Colors.dark.gold} />
            )}
          </View>
          <Text style={styles.heroTitle}>Buy & sell gold, directly</Text>
          <Text style={styles.heroBody}>
            Soon you'll be able to publish pieces of gold you want to sell —
            name your price and reach buyers right here in the app.
          </Text>
        </LinearGradient>
      </Animated.View>

      <View style={styles.featuresSection}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f.title}
            entering={FadeInDown.delay(160 + i * 70).duration(400).springify()}
            style={styles.featureRow}
          >
            <View style={styles.featureIcon}>
              <Feather name={f.icon} size={16} color={Colors.dark.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.Text
        entering={FadeInDown.delay(320).duration(400).springify()}
        style={styles.sectionTitle}
      >
        A taste of what's coming
      </Animated.Text>

      <View style={styles.listings}>
        <PreviewListing
          name="1 oz PAMP Suisse Bar"
          weight="31.1"
          premiumPct={3.2}
          index={0}
        />
        <PreviewListing
          name="Krugerrand 1 oz Coin"
          weight="31.1"
          premiumPct={2.4}
          index={1}
        />
        <PreviewListing
          name="50g Valcambi CombiBar"
          weight="50"
          premiumPct={4.1}
          index={2}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(600).duration(400).springify()}
      >
        <AnimatedPressable
          scaleDown={0.96}
          onPress={handleNotify}
          style={[styles.notifyButton, notified && styles.notifyButtonDone]}
        >
          {notified ? (
            <>
              <Feather name="check" size={18} color={Colors.dark.gold} />
              <Text style={styles.notifyTextDone}>
                You're on the list — we'll let you know
              </Text>
            </>
          ) : (
            <>
              <Feather name="bell" size={18} color={Colors.dark.background} />
              <Text style={styles.notifyText}>Notify me at launch</Text>
            </>
          )}
        </AnimatedPressable>
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
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  comingSoonPill: {
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  comingSoonText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 1,
  },
  heroCard: {
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  heroIconWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    backgroundColor: Colors.dark.goldFaint,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    textAlign: "center",
  },
  heroBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  featuresSection: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  featureBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  listings: {
    gap: 10,
  },
  listingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    opacity: 0.75,
  },
  listingImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  listingInfo: {
    flex: 1,
    gap: 3,
  },
  listingName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  listingMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  listingRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  listingPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
  },
  notifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 15,
  },
  notifyButtonDone: {
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  notifyText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  notifyTextDone: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.gold,
  },
});
