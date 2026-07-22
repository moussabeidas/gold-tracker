import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useGoldPrice, TROY_OUNCE_GRAMS } from "@/context/GoldPriceContext";
import { usePortfolio, GoldPurchase } from "@/context/PortfolioContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CountUp } from "@/components/CountUp";
import { useCurrency } from "@/context/CurrencyContext";
import { FocusReveal } from "@/components/FocusReveal";
import { SpinningCoin } from "@/components/SpinningCoin";
import { formatYmd } from "@/lib/dates";
import { resolveImageUri } from "@/lib/images";

function PurchaseCard({
  item,
  index,
  onDelete,
}: {
  item: GoldPurchase;
  index: number;
  onDelete: () => void;
}) {
  const { pricePerGram } = useGoldPrice();
  const currentValue = item.weightGrams * pricePerGram;
  const gain = currentValue - item.pricePaid;
  const gainPct = item.pricePaid ? (gain / item.pricePaid) * 100 : 0;
  const isPositive = gain >= 0;
  const gainColor = isPositive ? Colors.dark.positive : Colors.dark.negative;
  const isIOS = Platform.OS === "ios";

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Remove Purchase",
      "Are you sure you want to remove this from your portfolio?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onDelete },
      ]
    );
  };

  const formattedDate = formatYmd(item.purchaseDate);
  const { fmt } = useCurrency();
  const weightOz = (item.weightGrams / TROY_OUNCE_GRAMS).toFixed(4);
  const displayImage = resolveImageUri(item.imageUri);

  const handleEdit = () => {
    Haptics.selectionAsync();
    router.push({ pathname: "/add-purchase", params: { id: item.id } });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400).springify()}
      exiting={FadeOutUp.duration(260)}
      layout={LinearTransition.springify().damping(18)}
    >
      <Pressable onPress={handleEdit} style={styles.card}>
        <View style={styles.cardTop}>
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              {isIOS ? (
                <SymbolView name="seal.fill" tintColor={Colors.dark.gold} size={32} />
              ) : (
                <Feather name="circle" size={32} color={Colors.dark.gold} />
              )}
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.weightGrams}g · {weightOz} oz
            </Text>
            <Text style={styles.cardDate}>{formattedDate}</Text>
          </View>
          <AnimatedPressable
            scaleDown={0.85}
            onPress={handleDelete}
            hitSlop={12}
            style={styles.deleteButton}
          >
            <Feather name="trash-2" size={16} color={Colors.dark.textTertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Cost Basis</Text>
            <Text style={styles.cardStatValue}>{fmt(item.pricePaid, { decimals: 2 })}</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Current Value</Text>
            <Text style={styles.cardStatValue}>{fmt(currentValue, { decimals: 2 })}</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Gain / Loss</Text>
            <Text style={[styles.cardStatValue, { color: gainColor }]}>
              {isPositive ? "+" : ""}{fmt(Math.abs(gain), { decimals: 2 })}
              {"\n"}
              <Text style={[styles.cardStatSmall, { color: gainColor }]}>
                {isPositive ? "+" : ""}{gainPct.toFixed(1)}%
              </Text>
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { purchases, removePurchase, totalWeightGrams, totalInvested, isLoading } =
    usePortfolio();
  const { isPro, maxItems } = useSubscription();
  const { pricePerGram } = useGoldPrice();
  const isIOS = Platform.OS === "ios";

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const atLimit = !isPro && purchases.length >= maxItems;
  const currentTotalValue = totalWeightGrams * pricePerGram;
  const totalGain = currentTotalValue - totalInvested;
  const totalGainPct = totalInvested ? (totalGain / totalInvested) * 100 : 0;
  const isGainPositive = totalGain >= 0;
  const gainColor = isGainPositive ? Colors.dark.positive : Colors.dark.negative;
  const totalOz = (totalWeightGrams / TROY_OUNCE_GRAMS).toFixed(4);
  const { currency, convert, fmt } = useCurrency();

  const topPad =
    Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (atLimit) {
      router.push("/paywall");
    } else {
      router.push("/add-purchase");
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
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
      <FocusReveal offset={12} style={styles.header}>
        <Text style={styles.pageTitle}>Portfolio</Text>
        <AnimatedPressable
          scaleDown={0.88}
          style={[styles.addButton, atLimit && styles.addButtonLocked]}
          onPress={handleAdd}
        >
          {atLimit ? (
            <Feather name="lock" size={18} color={Colors.dark.background} />
          ) : (
            <Feather name="plus" size={20} color={Colors.dark.background} />
          )}
        </AnimatedPressable>
      </FocusReveal>

      {/* Free tier usage indicator */}
      {!isPro && (
        <FocusReveal delay={60} style={styles.tierBanner}>
          <View style={styles.tierLeft}>
            <Text style={styles.tierLabel}>
              {purchases.length} of {maxItems} free slots used
            </Text>
            <View style={styles.tierBar}>
              <View
                style={[
                  styles.tierFill,
                  {
                    width: `${Math.min((purchases.length / maxItems) * 100, 100)}%`,
                    backgroundColor: atLimit ? Colors.dark.negative : Colors.dark.gold,
                  },
                ]}
              />
            </View>
          </View>
          <AnimatedPressable
            scaleDown={0.94}
            onPress={() => router.push("/paywall")}
            style={styles.upgradeChip}
          >
            <Text style={styles.upgradeChipText}>
              {atLimit ? "Upgrade" : "Go Pro"}
            </Text>
          </AnimatedPressable>
        </FocusReveal>
      )}

      {purchases.length > 0 && (
        <FocusReveal delay={110} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <CountUp
            value={convert(currentTotalValue)}
            prefix={/[A-Za-z]$/.test(currency.symbol) ? `${currency.symbol} ` : currency.symbol}
            style={styles.summaryValue}
          />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Weight</Text>
              <Text style={styles.summaryItemValue}>
                {totalWeightGrams.toFixed(2)}g
              </Text>
              <Text style={styles.summaryItemSub}>{totalOz} oz</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Cost Basis</Text>
              <Text style={styles.summaryItemValue}>
                {fmt(totalInvested, { decimals: 2 })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Gain</Text>
              <Text style={[styles.summaryItemValue, { color: gainColor }]}>
                {isGainPositive ? "+" : ""}{fmt(Math.abs(totalGain), { decimals: 2 })}
              </Text>
              <Text style={[styles.summaryItemSub, { color: gainColor }]}>
                {isGainPositive ? "+" : ""}{totalGainPct.toFixed(1)}%
              </Text>
            </View>
          </View>
        </FocusReveal>
      )}

      {!isLoading && purchases.length === 0 && (
        <FocusReveal delay={80} style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <SpinningCoin size={72} periodMs={7000} />
          </View>
          <Text style={styles.emptyTitle}>No purchases yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button to add your first gold bar or coin
          </Text>
          <AnimatedPressable
            scaleDown={0.96}
            style={styles.emptyAddButton}
            onPress={handleAdd}
          >
            <Text style={styles.emptyAddButtonText}>Add Purchase</Text>
          </AnimatedPressable>
        </FocusReveal>
      )}

      {purchases.length > 0 && (
        <FocusReveal delay={170} style={styles.purchasesList}>
          <Text style={styles.sectionTitle}>Holdings</Text>
          {purchases.map((item, i) => (
            <PurchaseCard
              key={item.id}
              item={item}
              index={i}
              onDelete={() => removePurchase(item.id)}
            />
          ))}
        </FocusReveal>
      )}
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
    gap: 14,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonLocked: {
    backgroundColor: Colors.dark.textTertiary,
  },
  tierBanner: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tierLeft: {
    flex: 1,
    gap: 6,
  },
  tierLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  tierBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    overflow: "hidden",
  },
  tierFill: {
    height: 4,
    borderRadius: 2,
  },
  upgradeChip: {
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  upgradeChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  summaryCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 18,
    padding: 20,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
    paddingTop: 14,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryItemValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  summaryItemSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  emptyAddButton: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyAddButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  purchasesList: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  cardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  deleteButton: {
    padding: 6,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 14,
  },
  cardBottom: {
    flexDirection: "row",
    padding: 14,
  },
  cardStat: {
    flex: 1,
    gap: 2,
  },
  cardStatLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardStatValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    lineHeight: 20,
  },
  cardStatSmall: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
