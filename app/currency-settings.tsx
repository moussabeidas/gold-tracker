import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCIES, type Currency } from "@/lib/currency";

export default function CurrencySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { currency, switching, setCurrency } = useCurrency();
  const [query, setQuery] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [query]);

  const choose = async (item: Currency) => {
    if (switching) return;
    Haptics.selectionAsync();
    setPendingCode(item.code);
    const ok = await setCurrency(item.code);
    setPendingCode(null);
    if (!ok) {
      Alert.alert(
        "Couldn't switch currency",
        "The exchange rate for this currency isn't available right now. Check your connection and try again."
      );
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 },
        ]}
      >
        <AnimatedPressable
          scaleDown={0.9}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Feather name="chevron-down" size={22} color={Colors.dark.text} />
        </AnimatedPressable>
        <Text style={styles.title}>Currency</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={Colors.dark.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search currencies"
          placeholderTextColor={Colors.dark.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <Text style={styles.hint}>
        Prices across the app are shown in your chosen currency, converted
        live from USD. Subscription prices are always set by the App Store in
        your Apple ID's currency.
      </Text>

      <FlatList
        data={results}
        keyExtractor={(c) => c.code}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const selected = item.code === currency.code;
          const pending = pendingCode === item.code;
          return (
            <AnimatedPressable
              scaleDown={0.98}
              onPress={() => choose(item)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.symbol}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.code}</Text>
                <Text style={styles.rowName}>{item.name}</Text>
              </View>
              {pending ? (
                <ActivityIndicator size="small" color={Colors.dark.gold} />
              ) : selected ? (
                <Feather name="check" size={18} color={Colors.dark.gold} />
              ) : null}
            </AnimatedPressable>
          );
        }}
      />
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
  },
  hint: {
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  codeBadge: {
    minWidth: 44,
    paddingHorizontal: 6,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.gold,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  rowName: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
});
