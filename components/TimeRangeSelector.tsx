import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import { TimeRange } from "@/hooks/useGoldData";
import * as Haptics from "expo-haptics";

const RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onSelect: (range: TimeRange) => void;
}

export function TimeRangeSelector({ selected, onSelect }: TimeRangeSelectorProps) {
  return (
    <View style={styles.container}>
      {RANGES.map((range) => {
        const isSelected = range === selected;
        return (
          <Pressable
            key={range}
            style={({ pressed }) => [
              styles.button,
              isSelected && styles.buttonSelected,
              pressed && !isSelected && styles.buttonPressed,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(range);
            }}
          >
            <Text
              style={[
                styles.label,
                isSelected ? styles.labelSelected : styles.labelDefault,
              ]}
            >
              {range}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  button: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  buttonSelected: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  labelSelected: {
    color: Colors.dark.gold,
  },
  labelDefault: {
    color: Colors.dark.textSecondary,
  },
});
