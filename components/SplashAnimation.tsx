import React, { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Coin3D } from "@/components/Coin3D";

const COIN = 224;

interface Props {
  onFinish: () => void;
}

export function SplashAnimation({ onFinish }: Props) {
  // 3D coin spin: three full turns decelerating to face-on
  const rotY = useSharedValue(1080);
  const coinScale = useSharedValue(0.35);
  const coinOpacity = useSharedValue(0);
  // Specular sweep across the face after the spin settles
  const shineX = useSharedValue(-COIN * 1.2);
  // Text
  const textIn = useSharedValue(0);
  // Exit
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    coinOpacity.value = withTiming(1, { duration: 260 });
    coinScale.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
    rotY.value = withTiming(
      0,
      { duration: 1700, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    );

    // Light sweep right after the coin settles
    shineX.value = withDelay(
      1750,
      withTiming(COIN * 1.2, { duration: 620, easing: Easing.inOut(Easing.quad) })
    );

    textIn.value = withDelay(
      1150,
      withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) })
    );

    // Fade to the app
    exitOpacity.value = withDelay(
      2800,
      withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) })
    );
    const exitTimer = setTimeout(onFinish, 3300);
    return () => clearTimeout(exitTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value,
    transform: [{ scale: coinScale.value }],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shineX.value }, { rotate: "18deg" }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textIn.value,
    transform: [{ translateY: interpolate(textIn.value, [0, 1], [22, 0]) }],
  }));

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, exitStyle]}>
      {/* The coin — thickness + reeded rim, driven by the spin value */}
      <Animated.View style={[styles.coinWrap, coinStyle]}>
        <Coin3D size={COIN} rotation={rotY} />
        {/* Specular sweep, clipped to the coin circle */}
        <View style={styles.shineClip} pointerEvents="none">
          <Animated.View style={[styles.shineBar, shineStyle]}>
            <LinearGradient
              colors={[
                "rgba(255,255,255,0)",
                "rgba(255,248,214,0.45)",
                "rgba(255,255,255,0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* App name + commodity label */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.appName}>Gold Pricer</Text>
        <Text style={styles.appSubtitle}>XAU / USD</Text>
      </Animated.View>

      {/* Signature line */}
      <Animated.View style={[styles.footer, textStyle]}>
        <Text style={styles.footerText}>
          From the City of Gold to the world 🇦🇪
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.dark.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  coinWrap: {
    width: COIN,
    height: COIN,
    alignItems: "center",
    justifyContent: "center",
  },
  shineClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: COIN / 2,
    overflow: "hidden",
  },
  shineBar: {
    position: "absolute",
    top: -COIN * 0.25,
    bottom: -COIN * 0.25,
    width: COIN * 0.45,
    left: COIN * 0.28,
  },
  textContainer: {
    marginTop: 34,
    alignItems: "center",
    gap: 6,
  },
  footer: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 0.3,
  },
  // System font = San Francisco on iOS
  appName: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.gold,
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },
});
