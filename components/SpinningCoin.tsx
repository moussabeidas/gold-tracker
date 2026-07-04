import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const COIN_SOURCE = require("@/assets/images/splash-icon.png");

interface SpinningCoinProps {
  size?: number;
  /** Milliseconds per full turn */
  periodMs?: number;
}

/**
 * The app's coin, turning slowly and steadily in 3D. The rotation runs
 * natively on the UI thread (a single looping transform), so it costs
 * nothing on the JS thread and never interferes with scrolling.
 */
export function SpinningCoin({ size = 96, periodMs = 6000 }: SpinningCoinProps) {
  const turns = useSharedValue(0);

  useEffect(() => {
    turns.value = withRepeat(
      withTiming(360, { duration: periodMs, easing: Easing.linear }),
      -1
    );
  }, [turns, periodMs]);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${turns.value}deg` },
    ],
  }));

  // Subtle darkening while the coin is edge-on sells the 3D turn
  const shade = useDerivedValue(() => {
    const rad = (turns.value * Math.PI) / 180;
    return 1 - Math.abs(Math.cos(rad));
  });
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: shade.value * 0.6,
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, coinStyle]}>
      <Image
        source={COIN_SOURCE}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, { borderRadius: size / 2 }, shadeStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
