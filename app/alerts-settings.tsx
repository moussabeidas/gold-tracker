import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useGoldPrice } from "@/context/GoldPriceContext";
import {
  loadAlertPrefs,
  saveAlertPrefs,
  requestAlertPermission,
  DEFAULT_PREFS,
  type AlertPrefs,
} from "@/lib/alerts";

export default function AlertsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { anchorPrice } = useGoldPrice();
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const [aboveText, setAboveText] = useState("");
  const [belowText, setBelowText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAlertPrefs().then((p) => {
      setPrefs(p);
      setAboveText(p.above > 0 ? String(p.above) : "");
      setBelowText(p.below > 0 ? String(p.below) : "");
      setLoaded(true);
    });
  }, []);

  const update = useCallback(
    async (changes: Partial<AlertPrefs>) => {
      const next = { ...prefs, ...changes };
      setPrefs(next);
      await saveAlertPrefs(next);
    },
    [prefs]
  );

  const toggleEnabled = async (value: boolean) => {
    Haptics.selectionAsync();
    if (value) {
      const ok = await requestAlertPermission();
      if (!ok) {
        Alert.alert(
          "Notifications Off",
          "Enable notifications for Gold Pricer in Settings to receive price alerts."
        );
        return;
      }
    }
    update({ enabled: value });
  };

  const toggleDaily = async (value: boolean) => {
    Haptics.selectionAsync();
    if (value) {
      const ok = await requestAlertPermission();
      if (!ok) {
        Alert.alert(
          "Notifications Off",
          "Enable notifications for Gold Pricer in Settings to receive the daily brief."
        );
        return;
      }
    }
    update({ dailyBrief: value });
  };

  const commitTarget = (which: "above" | "below", text: string) => {
    const value = Number(text.replace(/[^0-9.]/g, ""));
    const cleaned = isFinite(value) && value > 0 ? Math.round(value) : 0;
    update({ [which]: cleaned } as Partial<AlertPrefs>);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <AnimatedPressable scaleDown={0.9} onPress={() => router.back()} style={styles.closeButton}>
          <Feather name="chevron-down" size={22} color={Colors.dark.text} />
        </AnimatedPressable>
        <Text style={styles.title}>Price Alerts</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="bell" size={16} color={Colors.dark.gold} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Price alerts</Text>
              <Text style={styles.rowHint}>
                Get notified when gold crosses your targets
              </Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ true: Colors.dark.gold, false: Colors.dark.surface }}
              thumbColor="#fff"
              disabled={!loaded}
            />
          </View>
        </View>

        {prefs.enabled && (
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBordered]}>
              <View style={styles.rowIcon}>
                <Feather name="arrow-up-right" size={16} color={Colors.dark.positive} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Rises above</Text>
                <Text style={styles.rowHint}>USD per troy ounce</Text>
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  value={aboveText}
                  onChangeText={setAboveText}
                  onEndEditing={() => commitTarget("above", aboveText)}
                  keyboardType="number-pad"
                  placeholder={String(Math.round(anchorPrice + 50))}
                  placeholderTextColor={Colors.dark.textTertiary}
                  returnKeyType="done"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Feather name="arrow-down-right" size={16} color={Colors.dark.negative} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Falls below</Text>
                <Text style={styles.rowHint}>USD per troy ounce</Text>
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  value={belowText}
                  onChangeText={setBelowText}
                  onEndEditing={() => commitTarget("below", belowText)}
                  keyboardType="number-pad"
                  placeholder={String(Math.round(anchorPrice - 50))}
                  placeholderTextColor={Colors.dark.textTertiary}
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="sunrise" size={16} color={Colors.dark.gold} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Daily brief</Text>
              <Text style={styles.rowHint}>A 9 AM nudge with the market open</Text>
            </View>
            <Switch
              value={prefs.dailyBrief}
              onValueChange={toggleDaily}
              trackColor={{ true: Colors.dark.gold, false: Colors.dark.surface }}
              thumbColor="#fff"
              disabled={!loaded}
            />
          </View>
        </View>

        <Text style={styles.footnote}>
          Live price checks run while the app is open and periodically in the
          background. Spot gold is currently ${anchorPrice.toFixed(2)} per
          troy ounce.
        </Text>
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
    gap: 14,
    paddingTop: 8,
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
    paddingVertical: 13,
    gap: 12,
  },
  rowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  rowHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  inputPrefix: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  input: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    textAlign: "right",
  },
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textTertiary,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
});
