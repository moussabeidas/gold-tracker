import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";

const COIN_SOURCE = require("@/assets/images/splash-icon.png");

// The coin's body is built from stacked cross-section slices that fan out
// horizontally as the coin turns — RN transforms can't extrude, but this
// reads as real thickness. Alternating light/dark slices produce the
// vertical ridges of a reeded rim, exactly like a minted coin's edge.
const SLICES = 11;
const RIM_LIGHT = "#C89B33";
const RIM_DARK = "#5E430C";

interface Coin3DProps {
  size: number;
  /** Edge thickness at full profile, defaults to ~8% of the diameter */
  thickness?: number;
  /** External rotation in degrees; omit to spin continuously */
  rotation?: SharedValue<number>;
  /** Continuous-spin period when no external rotation is given */
  periodMs?: number;
}

function RimSlice({
  index,
  size,
  thickness,
  rot,
}: {
  index: number;
  size: number;
  thickness: number;
  rot: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const rad = (rot.value * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const depth = (index / (SLICES - 1) - 0.5) * thickness;
    return {
      transform: [
        { translateX: depth * s },
        { scaleX: Math.max(Math.abs(c), 0.04) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: size / 2,
          backgroundColor: index % 2 === 0 ? RIM_LIGHT : RIM_DARK,
        },
        style,
      ]}
    />
  );
}

export function Coin3D({
  size,
  thickness = Math.max(6, size * 0.08),
  rotation,
  periodMs = 7000,
}: Coin3DProps) {
  const internal = useSharedValue(0);
  const rot = rotation ?? internal;

  useEffect(() => {
    if (rotation) return; // externally driven
    internal.value = withRepeat(
      withTiming(360, { duration: periodMs, easing: Easing.linear }),
      -1
    );
  }, [rotation, internal, periodMs]);

  // The face always renders on the coin's front-most surface
  const faceStyle = useAnimatedStyle(() => {
    const rad = (rot.value * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const frontDepth = c >= 0 ? -thickness / 2 : thickness / 2;
    return {
      transform: [
        { translateX: frontDepth * s },
        { scaleX: Math.abs(c) < 0.04 ? 0.04 : c },
      ],
    };
  });

  // Edge-on darkening sells the turn
  const shadeStyle = useAnimatedStyle(() => {
    const rad = (rot.value * Math.PI) / 180;
    return { opacity: (1 - Math.abs(Math.cos(rad))) * 0.55 };
  });

  const slices = Array.from({ length: SLICES }, (_, i) => i);

  return (
    <View style={{ width: size, height: size }}>
      {slices.map((i) => (
        <RimSlice
          key={i}
          index={i}
          size={size}
          thickness={thickness}
          rot={rot}
        />
      ))}
      <Animated.View style={[StyleSheet.absoluteFillObject, faceStyle]}>
        <Image
          source={COIN_SOURCE}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: size / 2, backgroundColor: "#000" },
            shadeStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
}
