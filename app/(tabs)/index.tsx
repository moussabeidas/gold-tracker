import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useGoldData, TimeRange } from "@/hooks/useGoldData";
import { GoldChart } from "@/components/GoldChart";
import { PriceHeader } from "@/components/PriceHeader";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { StatCard } from "@/components/StatCard";
import { NewsItem } from "@/components/NewsItem";
import { GOLD_NEWS } from "@/data/news";

const { width: SCREEN_W } = Dimensions.get("window");

function formatPrice(price: number) {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(timestamp: number, range: TimeRange) {
  const d = new Date(timestamp);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (range === "1W") {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GoldScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<TimeRange>("1D");
  const [scrubPrice, setScrubPrice] = useState<number | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, currentPrice, change, changePct, isPositive, isLoading } =
    useGoldData(range);

  const handleScrub = useCallback(
    (price: number | null, index: number | null) => {
      setScrubPrice(price);
      setScrubIndex(index);
      if (price !== null) {
        Haptics.selectionAsync();
      }
    },
    []
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const topPad =
    Platform.OS === "web"
      ? insets.top + 67
      : insets.top + 8;

  const statsRow1 = [
    {
      label: "Open",
      value: data.length ? `$${formatPrice(data[0].price)}` : "—",
    },
    {
      label: "High",
      value: data.length
        ? `$${formatPrice(Math.max(...data.map((d) => d.price)))}`
        : "—",
    },
  ];

  const statsRow2 = [
    {
      label: "Low",
      value: data.length
        ? `$${formatPrice(Math.min(...data.map((d) => d.price)))}`
        : "—",
    },
    {
      label: "52W High",
      value: "$3,217.40",
    },
  ];

  const statsRow3 = [
    { label: "52W Low", value: "$2,164.40" },
    { label: "Volume", value: "$148.2B" },
  ];

  const scrubTime =
    scrubIndex !== null && data[scrubIndex]
      ? formatTime(data[scrubIndex].time, range)
      : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 8,
          paddingBottom:
            Platform.OS === "web"
              ? insets.bottom + 34 + 84
              : insets.bottom + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.dark.gold}
        />
      }
    >
      {scrubTime && (
        <View style={styles.scrubTimeContainer}>
          <Text style={styles.scrubTime}>{scrubTime}</Text>
        </View>
      )}

      <PriceHeader
        currentPrice={currentPrice}
        change={change}
        changePct={changePct}
        isPositive={isPositive}
        scrubPrice={scrubPrice}
      />

      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.dark.gold} />
          </View>
        ) : (
          <GoldChart
            data={data}
            isPositive={isPositive}
            onScrub={handleScrub}
          />
        )}
      </View>

      <View style={styles.divider} />

      <TimeRangeSelector selected={range} onSelect={setRange} />

      <View style={styles.divider} />

      <View style={styles.statsSection}>
        <View style={styles.statsRow}>
          {statsRow1.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </View>
        <View style={styles.statsRow}>
          {statsRow2.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </View>
        <View style={styles.statsRow}>
          {statsRow3.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </View>
      </View>

      <View style={styles.aboutSection}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About Gold (XAU)</Text>
          <Text style={styles.aboutBody}>
            Gold is a precious metal with the chemical symbol Au and atomic
            number 79. Priced in US dollars per troy ounce, XAU/USD is one of
            the world's most widely traded commodities. Gold serves as a
            universal store of value and a safe-haven asset during periods of
            economic uncertainty or geopolitical tension.{"\n\n"}Gold is mined
            on every continent except Antarctica and is held as reserves by
            central banks worldwide. Its price is influenced by interest rates,
            US dollar strength, inflation expectations, and global risk
            sentiment.
          </Text>
        </View>
      </View>

      <View style={styles.newsSection}>
        <Text style={styles.sectionTitle}>News</Text>
        <View style={styles.newsCard}>
          {GOLD_NEWS.map((article, i) => (
            <NewsItem
              key={article.id}
              article={article}
              isLast={i === GOLD_NEWS.length - 1}
            />
          ))}
        </View>
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
  },
  scrubTimeContainer: {
    alignItems: "center",
    paddingBottom: 2,
  },
  scrubTime: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  chartContainer: {
    height: 200,
    overflow: "hidden",
  },
  loadingContainer: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 0,
  },
  statsSection: {
    padding: 16,
    gap: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  aboutSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  aboutCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  aboutTitle: {
    fontSize: 17,
    color: Colors.dark.text,
    fontFamily: "Inter_700Bold",
  },
  aboutBody: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  newsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    paddingHorizontal: 20,
  },
  newsCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    marginHorizontal: 16,
    overflow: "hidden",
  },
});
