import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface MetalItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePct: string;
  isPositive: boolean;
  sfIcon?: string;
  featherIcon: string;
}

const METALS: MetalItem[] = [
  {
    symbol: "XAU",
    name: "Gold",
    price: "$3,150.40",
    change: "+$28.60",
    changePct: "+0.92%",
    isPositive: true,
    sfIcon: "seal.fill",
    featherIcon: "circle",
  },
  {
    symbol: "XAG",
    name: "Silver",
    price: "$34.18",
    change: "-$0.42",
    changePct: "-1.21%",
    isPositive: false,
    sfIcon: "circle.fill",
    featherIcon: "circle",
  },
  {
    symbol: "XPT",
    name: "Platinum",
    price: "$1,012.55",
    change: "+$4.20",
    changePct: "+0.42%",
    isPositive: true,
    sfIcon: "diamond.fill",
    featherIcon: "hexagon",
  },
  {
    symbol: "XPD",
    name: "Palladium",
    price: "$987.30",
    change: "-$11.10",
    changePct: "-1.11%",
    isPositive: false,
    sfIcon: "hexagon.fill",
    featherIcon: "hexagon",
  },
];

function MetalRow({ item, isLast }: { item: MetalItem; isLast?: boolean }) {
  const [pressed, setPressed] = useState(false);
  const color = item.isPositive ? Colors.dark.positive : Colors.dark.negative;
  const bgColor = item.isPositive
    ? Colors.dark.positiveBackground
    : Colors.dark.negativeBackground;
  const isIOS = Platform.OS === "ios";

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => Haptics.selectionAsync()}
      style={[
        styles.row,
        !isLast && styles.rowBordered,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: Colors.dark.goldFaint }]}>
        {isIOS ? (
          <SymbolView
            name={item.sfIcon ?? "circle.fill"}
            tintColor={Colors.dark.gold}
            size={20}
          />
        ) : (
          <Feather name="circle" size={20} color={Colors.dark.gold} />
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text style={styles.rowSymbol}>{item.symbol}</Text>
        <Text style={styles.rowName}>{item.name}</Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>{item.price}</Text>
        <View style={[styles.changeBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.changeText, { color }]}>{item.changePct}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
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
              : insets.bottom + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Watchlist</Text>

      <View style={styles.card}>
        {METALS.map((item, i) => (
          <MetalRow key={item.symbol} item={item} isLast={i === METALS.length - 1} />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Market Overview</Text>
      </View>

      <View style={styles.overviewGrid}>
        {[
          {
            label: "USD Index",
            value: "103.42",
            change: "-0.18%",
            isPositive: false,
          },
          {
            label: "US 10Y Yield",
            value: "4.52%",
            change: "+0.03%",
            isPositive: true,
          },
          {
            label: "Crude Oil",
            value: "$78.40",
            change: "+0.64%",
            isPositive: true,
          },
          { label: "S&P 500", value: "5,214", change: "+0.28%", isPositive: true },
        ].map((item) => {
          const color = item.isPositive
            ? Colors.dark.positive
            : Colors.dark.negative;
          return (
            <View key={item.label} style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>{item.label}</Text>
              <Text style={styles.overviewValue}>{item.value}</Text>
              <Text style={[styles.overviewChange, { color }]}>
                {item.change}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.goldFactsCard}>
        <Text style={styles.goldFactsTitle}>Gold Facts</Text>
        {[
          { icon: "globe", text: "1 troy ounce = 31.103 grams" },
          { icon: "bar-chart-2", text: "Over 197,000 tonnes ever mined" },
          { icon: "shield", text: "COMEX is the world's largest gold futures market" },
          { icon: "zap", text: "Gold conducts electricity and never corrodes" },
        ].map((fact) => (
          <View key={fact.text} style={styles.factRow}>
            <View style={styles.factIconContainer}>
              <Feather name={fact.icon as any} size={14} color={Colors.dark.gold} />
            </View>
            <Text style={styles.factText}>{fact.text}</Text>
          </View>
        ))}
      </View>
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
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowSymbol: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  rowName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  rowPrice: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  overviewCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    width: "47.5%",
    gap: 4,
  },
  overviewLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  overviewChange: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  goldFactsCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  goldFactsTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  factText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    flex: 1,
  },
});
