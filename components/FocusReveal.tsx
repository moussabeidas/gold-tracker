import React, { useCallback } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  interpolate,
} from "react-native-reanimated";

interface FocusRevealProps {
  /** Stagger delay in ms */
  delay?: number;
  /** How far the element rises from, in pt */
  offset?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Rises and fades its children in every time the screen gains focus —
 * so tab switches feel as considered as first launch. Runs entirely on
 * the UI thread and preserves state/scroll (no remounting).
 */
export function FocusReveal({
  delay = 0,
  offset = 16,
  style,
  children,
}: FocusRevealProps) {
  const progress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withSpring(1, { damping: 19, stiffness: 180, mass: 0.7 })
      );
    }, [delay, progress])
  );

  const aStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [offset, 0]) },
    ],
  }));

  return <Animated.View style={[aStyle, style]}>{children}</Animated.View>;
}
