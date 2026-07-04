import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { TimeRange } from "@/hooks/useGoldData";
import * as Haptics from "expo-haptics";

const RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onSelect: (range: TimeRange) => void;
}

export function TimeRangeSelector({ selected, onSelect }: TimeRangeSelectorProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const slotWidth = trackWidth / RANGES.length;
  const position = useSharedValue(RANGES.indexOf(selected));

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(position.value * slotWidth, {
          damping: 18,
          stiffness: 220,
        }),
      },
    ],
  }));

  const handleSelect = (range: TimeRange, index: number) => {
    Haptics.selectionAsync();
    position.value = index;
    onSelect(range);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {slotWidth > 0 && (
        <Animated.View
          style={[styles.pill, { width: slotWidth - 4 }, pillStyle]}
        />
      )}
      {RANGES.map((range, i) => {
        const isSelected = range === selected;
        return (
          <Pressable
            key={range}
            style={({ pressed }) => [
              styles.button,
              pressed && !isSelected && styles.buttonPressed,
            ]}
            onPress={() => handleSelect(range, i)}
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
    marginHorizontal: 16,
    marginVertical: 8,
    position: "relative",
  },
  pill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 2,
    borderRadius: 9,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.25)",
  },
  button: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 9,
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
