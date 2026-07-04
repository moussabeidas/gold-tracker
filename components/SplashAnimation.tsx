import React, { useEffect } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const COIN = 224;
const COIN_SOURCE = require("@/assets/images/splash-icon.png");

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

  // The coin darkens as its edge faces the viewer — sells the 3D turn
  const edgeShade = useDerivedValue(() => {
    const rad = (rotY.value * Math.PI) / 180;
    return 1 - Math.abs(Math.cos(rad));
  });

  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value,
    transform: [
      { perspective: 1100 },
      { rotateY: `${rotY.value}deg` },
      { scale: coinScale.value },
    ],
  }));

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: edgeShade.value * 0.75,
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
      {/* The coin — perspective rotateY gives the 3D flip */}
      <Animated.View style={[styles.coinWrap, coinStyle]}>
        <Image source={COIN_SOURCE} style={styles.coin} resizeMode="contain" />
        {/* Edge shading while the coin is side-on */}
        <Animated.View style={[styles.coinShade, shadeStyle]} pointerEvents="none" />
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
        <Text style={styles.appName}>Gold</Text>
        <Text style={styles.appSubtitle}>XAU / USD</Text>
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
  coin: {
    width: COIN,
    height: COIN,
  },
  coinShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: COIN / 2,
    backgroundColor: "#000",
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
  appName: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.gold,
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },
});
