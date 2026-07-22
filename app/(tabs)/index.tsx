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
import { FocusReveal } from "@/components/FocusReveal";

import Colors from "@/constants/colors";
import { useCurrency } from "@/context/CurrencyContext";
import { useGoldData, TimeRange } from "@/hooks/useGoldData";
import { GoldChart } from "@/components/GoldChart";
import { PriceHeader } from "@/components/PriceHeader";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { StatCard } from "@/components/StatCard";
import { NewsItem } from "@/components/NewsItem";
import { useGoldNews } from "@/hooks/useGoldNews";
import { ShareGoldButton } from "@/components/ShareGoldButton";

const { width: SCREEN_W } = Dimensions.get("window");

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

  const {
    data,
    currentPrice,
    change,
    changePct,
    isPositive,
    isLoading,
    isLive,
    week52,
    refresh,
    scale,
  } = useGoldData(range);
  const { fmt } = useCurrency();
  const { articles } = useGoldNews();

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  }, [refresh]);

  const topPad =
    Platform.OS === "web"
      ? insets.top + 67
      : insets.top + 8;

  const statsRow1 = [
    {
      label: "Open",
      value: data.length ? fmt(data[0].price, { decimals: 2 }) : "—",
    },
    {
      label: "High",
      value: data.length
        ? fmt(Math.max(...data.map((d) => d.price)), { decimals: 2 })
        : "—",
    },
  ];

  const statsRow2 = [
    {
      label: "Low",
      value: data.length
        ? fmt(Math.min(...data.map((d) => d.price)), { decimals: 2 })
        : "—",
    },
    {
      label: "52W High",
      value: fmt(
        week52 ? Math.max(week52.high, currentPrice) : Math.max(3217.4 * scale, currentPrice),
        { decimals: 2 }
      ),
    },
  ];

  const statsRow3 = [
    {
      label: "52W Low",
      value: fmt(week52 ? week52.low : 2164.4 * scale, { decimals: 2 }),
    },
    { label: "Volume", value: "$148.2B" },
  ];

  const scrubTime =
    scrubIndex !== null && data[scrubIndex]
      ? formatTime(data[scrubIndex].time, range)
      : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 8,
          paddingBottom:
            Platform.OS === "web"
              ? insets.bottom + 34 + 84
              : insets.bottom + 108,
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
      <FocusReveal offset={12}>
      <View style={styles.topRow}>
        <Text style={styles.dateLabel}>
          {new Date()
            .toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
            .toUpperCase()}
        </Text>
        <ShareGoldButton
          data={{ price: currentPrice, change, changePct, isPositive }}
        />
      </View>
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
        isLive={isLive}
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
      </FocusReveal>

      <View style={styles.statsSection}>
        {[statsRow1, statsRow2, statsRow3].map((row, i) => (
          <FocusReveal key={i} delay={70 + i * 60} style={styles.statsRow}>
            {row.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </FocusReveal>
        ))}
      </View>

      <FocusReveal delay={330} style={styles.newsSection}>
        <Text style={styles.sectionTitle}>News</Text>
        <View style={styles.newsCard}>
          {articles.map((article, i) => (
            <NewsItem
              key={article.id}
              article={article}
              isLast={i === articles.length - 1}
            />
          ))}
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
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textTertiary,
    letterSpacing: 1.2,
    flex: 1,
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
