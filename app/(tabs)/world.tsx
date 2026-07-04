import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { WorldMap } from "@/components/WorldMap";
import {
  useWorldEvents,
  WorldEvent,
  WorldCategory,
  CATEGORY_META,
} from "@/hooks/useWorldEvents";

// The World tab — a live global intelligence map in the spirit of PYTHIA
// (https://github.com/jangles-byte/Pythia): watch the whole planet at once,
// with the events most likely to move gold ranked on top.

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_WIDTH = Math.min(SCREEN_W - 32, 760);

const FILTERS: Array<{ key: WorldCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "gold", label: CATEGORY_META.gold.label },
  { key: "geopolitical", label: CATEGORY_META.geopolitical.label },
  { key: "seismic", label: CATEGORY_META.seismic.label },
  { key: "storm", label: CATEGORY_META.storm.label },
  { key: "wildfire", label: CATEGORY_META.wildfire.label },
  { key: "disaster", label: CATEGORY_META.disaster.label },
];

function timeAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function EventRow({
  event,
  isSelected,
  isLast,
  onPress,
}: {
  event: WorldEvent;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const color = CATEGORY_META[event.category].color;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.eventRow,
        !isLast && styles.eventRowBordered,
        isSelected && styles.eventRowSelected,
      ]}
    >
      <View style={[styles.eventDot, { backgroundColor: color }]} />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta}>
          {CATEGORY_META[event.category].label} · {event.source} ·{" "}
          {timeAgo(event.ts)}
        </Text>
      </View>
      <View style={styles.salienceBadge}>
        <Text style={[styles.salienceText, { color }]}>
          {Math.round(event.salience * 100)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function WorldScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;
  const { events, isLoading, lastUpdated, feedsOnline, refresh } =
    useWorldEvents();
  const [filter, setFilter] = useState<WorldCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.category === filter)),
    [events, filter],
  );
  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? null,
    [filtered, selectedId],
  );
  const topSignals = useMemo(() => filtered.slice(0, 12), [filtered]);

  const activeCategories = useMemo(() => {
    const present = new Set(filtered.map((e) => e.category));
    return (Object.keys(CATEGORY_META) as WorldCategory[]).filter((c) =>
      present.has(c),
    );
  }, [filtered]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const selectEvent = useCallback((ev: WorldEvent) => {
    setSelectedId((prev) => (prev === ev.id ? null : ev.id));
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom:
            Platform.OS === "web" ? insets.bottom + 34 + 84 : insets.bottom + 20,
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
      <Text style={styles.pageTitle}>World</Text>
      <Text style={styles.pageSubtitle}>
        Live global signals — the events that move gold
      </Text>

      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  feedsOnline > 0 ? Colors.dark.positive : Colors.dark.negative,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {feedsOnline > 0
              ? `${feedsOnline} feed${feedsOnline === 1 ? "" : "s"} live`
              : "connecting…"}
          </Text>
        </View>
        <Text style={styles.statusText}>
          {filtered.length} events
          {lastUpdated ? ` · updated ${timeAgo(lastUpdated)}` : ""}
        </Text>
      </View>

      {isLoading && events.length === 0 ? (
        <View style={[styles.mapPlaceholder, { width: MAP_WIDTH, height: MAP_WIDTH / 2 }]}>
          <ActivityIndicator color={Colors.dark.gold} />
          <Text style={styles.placeholderText}>Sensing the world…</Text>
        </View>
      ) : (
        <WorldMap
          width={MAP_WIDTH}
          events={filtered}
          selectedId={selectedId}
          onSelect={selectEvent}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
                setSelectedId(null);
              }}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              {f.key !== "all" && (
                <View
                  style={[
                    styles.filterDot,
                    { backgroundColor: CATEGORY_META[f.key as WorldCategory].color },
                  ]}
                />
              )}
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeCategories.length > 0 && (
        <View style={styles.legend}>
          {activeCategories.map((c) => (
            <View key={c} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: CATEGORY_META[c].color }]}
              />
              <Text style={styles.legendText}>{CATEGORY_META[c].label}</Text>
            </View>
          ))}
        </View>
      )}

      {selected && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: `${CATEGORY_META[selected.category].color}22` },
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  { color: CATEGORY_META[selected.category].color },
                ]}
              >
                {CATEGORY_META[selected.category].label}
              </Text>
            </View>
            <Text style={styles.detailTime}>{timeAgo(selected.ts)}</Text>
          </View>
          <Text style={styles.detailTitle}>{selected.title}</Text>
          {!!selected.summary && (
            <Text style={styles.detailSummary} numberOfLines={4}>
              {selected.summary}
            </Text>
          )}
          <View style={styles.salienceBarTrack}>
            <View
              style={[
                styles.salienceBarFill,
                {
                  width: `${Math.round(selected.salience * 100)}%`,
                  backgroundColor: CATEGORY_META[selected.category].color,
                },
              ]}
            />
          </View>
          <View style={styles.detailFooter}>
            <Text style={styles.detailMeta}>
              salience {Math.round(selected.salience * 100)} · {selected.source} ·{" "}
              {selected.lat.toFixed(1)}°, {selected.lng.toFixed(1)}°
            </Text>
            {!!selected.url && (
              <Pressable
                onPress={() => Linking.openURL(selected.url!)}
                hitSlop={8}
                style={styles.sourceLink}
              >
                <Text style={styles.sourceLinkText}>Source</Text>
                <Feather
                  name="external-link"
                  size={12}
                  color={Colors.dark.gold}
                />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Signals</Text>
      </View>

      {topSignals.length > 0 ? (
        <View style={styles.card}>
          {topSignals.map((ev, i) => (
            <EventRow
              key={ev.id}
              event={ev}
              isSelected={ev.id === selectedId}
              isLast={i === topSignals.length - 1}
              onPress={() => selectEvent(ev)}
            />
          ))}
        </View>
      ) : (
        !isLoading && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No live events for this filter right now. Pull to refresh.
            </Text>
          </View>
        )
      )}

      <View style={styles.creditCard}>
        <Feather name="eye" size={14} color={Colors.dark.goldDim} />
        <Text style={styles.creditText}>
          Watching USGS earthquakes, NASA EONET disasters and GDELT global news
          — free, keyless feeds, fused PYTHIA-style. Set EXPO_PUBLIC_PYTHIA_URL
          to a running PYTHIA engine to add its world view and forecasts.
        </Text>
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
    gap: 14,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginTop: -10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textTertiary,
  },
  mapPlaceholder: {
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  placeholderText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.goldFaint,
    borderColor: Colors.dark.goldDim,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: Colors.dark.gold,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    rowGap: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  detailCard: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.goldDim,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  detailTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    lineHeight: 22,
  },
  detailSummary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 19,
  },
  salienceBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    overflow: "hidden",
  },
  salienceBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  detailFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    flex: 1,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceLinkText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.gold,
  },
  sectionHeader: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  card: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    overflow: "hidden",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  eventRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  eventRowSelected: {
    backgroundColor: Colors.dark.goldFaint,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    lineHeight: 19,
  },
  eventMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  salienceBadge: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.dark.surface,
    alignItems: "center",
  },
  salienceText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    padding: 16,
    textAlign: "center",
  },
  creditCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  creditText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    lineHeight: 16,
  },
});
