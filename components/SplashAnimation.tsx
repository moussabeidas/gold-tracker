import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Text,
  Platform,
} from "react-native";
import Colors from "@/constants/colors";

const USE_NATIVE = Platform.OS !== "web";

// The logo: a gold ring on a dark circular bg
// Outer disc diameter
const DISC = 160;
// Ring (border) thickness
const RING_BORDER = 8;

interface Props {
  onFinish: () => void;
}

// One expanding sonar ring keyed off an Animated.Value 0→1
function SonarRing({ anim }: { anim: Animated.Value }) {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.6] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 0.6, 0.25, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sonarRing, { opacity, transform: [{ scale }] }]}
    />
  );
}

export function SplashAnimation({ onFinish }: Props) {
  // Logo entrance
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Logo micro-pulse
  const pulse = useRef(new Animated.Value(1)).current;
  // Sonar rings (3)
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  // Text
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(20)).current;
  // Exit
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1 — logo springs into view
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 85,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();

    // Phase 2 — micro-pulse after spring settles
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.07,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
      ]).start();
    }, 380);

    // Phase 3 — sonar rings fire in sequence
    const fireRing = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        anim.setValue(0);
        Animated.timing(anim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }).start();
      }, delay);
    };
    fireRing(ring1, 250);
    fireRing(ring2, 580);
    fireRing(ring3, 910);

    // Phase 4 — text rises up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(textY, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }),
      ]).start();
    }, 650);

    // Phase 5 — fade to black
    setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }).start();
    }, 2500);

    // Hard exit at 3050ms
    const exitTimer = setTimeout(onFinish, 3050);
    return () => clearTimeout(exitTimer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      {/* Sonar rings expand from the centre */}
      <View style={styles.anchor} pointerEvents="none">
        <SonarRing anim={ring1} />
        <SonarRing anim={ring2} />
        <SonarRing anim={ring3} />
      </View>

      {/* Logo: dark disc + gold ring */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: Animated.multiply(logoScale, pulse) }],
          },
        ]}
      >
        {/* Dark circular background */}
        <View style={styles.disc}>
          {/* Gold ring border (rendered as a circle with border) */}
          <View style={styles.ring} />
        </View>
      </Animated.View>

      {/* App name + commodity label */}
      <Animated.View
        style={[
          styles.textContainer,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}
      >
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
  // Anchor for sonar rings — same size as the disc
  anchor: {
    position: "absolute",
    width: DISC,
    height: DISC,
    alignItems: "center",
    justifyContent: "center",
  },
  sonarRing: {
    position: "absolute",
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 1.5,
    borderColor: Colors.dark.gold,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: "#111008",
    alignItems: "center",
    justifyContent: "center",
    // Gold glow on the circle itself
    shadowColor: Colors.dark.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 16,
  },
  // The gold ring inside the disc — sized to match the logo image proportions
  ring: {
    width: DISC * 0.58,
    height: DISC * 0.58,
    borderRadius: (DISC * 0.58) / 2,
    borderWidth: RING_BORDER,
    borderColor: Colors.dark.gold,
    backgroundColor: "transparent",
  },
  textContainer: {
    marginTop: 30,
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
