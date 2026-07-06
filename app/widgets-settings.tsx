import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useGoldPrice } from "@/context/GoldPriceContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { publishWidgetSnapshot } from "@/lib/widgetBridge";

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Miniature preview of the home-screen widgets, drawn in RN. */
function WidgetPreview({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <LinearGradient
      colors={["#17171B", "#0A0A0E"]}
      style={styles.previewCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.previewHeader}>
        <View style={styles.previewCoin}>
          <Text style={styles.previewCoinText}>Au</Text>
        </View>
        <Text style={styles.previewTitle}>{title}</Text>
      </View>
      <Text style={styles.previewValue}>{value}</Text>
      <View style={styles.previewSubRow}>
        <Feather name={icon} size={11} color={Colors.dark.gold} />
        <Text style={styles.previewSub}>{sub}</Text>
      </View>
    </LinearGradient>
  );
}

const STEPS = [
  "Touch and hold an empty area of your Home Screen",
  "Tap the Edit button in the top corner, then Add Widget",
  "Search for “Gold Pricer”",
  "Pick Gold Price or My Gold Portfolio, choose a size, tap Add Widget",
];

const LOCK_STEPS = [
  "Touch and hold your Lock Screen, then tap Customize",
  "Select the widget area below the clock",
  "Choose Gold Pricer to add the live price or your portfolio",
];

export default function WidgetsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { anchorPrice, dayOpen } = useGoldPrice();
  const { totalWeightGrams, totalInvested, purchases } = usePortfolio();
  const [refreshed, setRefreshed] = useState(false);

  const change = anchorPrice - dayOpen;
  const changePct = dayOpen ? (change / dayOpen) * 100 : 0;
  const portfolioValue = totalWeightGrams * (anchorPrice / 31.1035);

  const handleRefresh = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    publishWidgetSnapshot({
      price: anchorPrice,
      prevClose: dayOpen,
      pureGrams: totalWeightGrams,
      costBasis: totalInvested,
      holdingsCount: purchases.length,
      updatedAt: Math.floor(Date.now() / 1000),
    });
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <AnimatedPressable scaleDown={0.9} onPress={() => router.back()} style={styles.closeButton}>
          <Feather name="chevron-down" size={22} color={Colors.dark.text} />
        </AnimatedPressable>
        <Text style={styles.title}>Widgets</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewRow}>
          <WidgetPreview
            title="GOLD"
            value={formatUsd(anchorPrice)}
            sub={`${change >= 0 ? "+" : "−"}${Math.abs(changePct).toFixed(2)}% today`}
            icon={change >= 0 ? "trending-up" : "trending-down"}
          />
          <WidgetPreview
            title="PORTFOLIO"
            value={purchases.length ? formatUsd(portfolioValue) : "—"}
            sub={
              purchases.length
                ? `${totalWeightGrams.toFixed(1)}g of gold`
                : "Add gold to track"
            }
            icon="briefcase"
          />
        </View>

        <Text style={styles.blurb}>
          Live gold price and your portfolio value, on your Home Screen and
          Lock Screen. Widgets refresh on their own — and instantly whenever
          you open the app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add to Home Screen</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add to Lock Screen</Text>
          {LOCK_STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <AnimatedPressable scaleDown={0.97} style={styles.refreshButton} onPress={handleRefresh}>
          <Feather
            name={refreshed ? "check" : "refresh-cw"}
            size={16}
            color={Colors.dark.background}
          />
          <Text style={styles.refreshText}>
            {refreshed ? "Widgets updated" : "Refresh widgets now"}
          </Text>
        </AnimatedPressable>
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
    gap: 16,
    paddingTop: 8,
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
  },
  previewCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 22,
    padding: 14,
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.18)",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewCoin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.dark.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCoinText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#4A3502",
  },
  previewTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
    letterSpacing: 0.6,
  },
  previewValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    fontVariant: ["tabular-nums"],
  },
  previewSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewSub: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  blurb: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 19,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 14,
  },
  refreshText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
});
