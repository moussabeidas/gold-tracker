import React, { useEffect } from "react";
import { TextInput, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface CountUpProps {
  /** Target value — changes animate smoothly from the previous value */
  value: number;
  prefix?: string;
  decimals?: number;
  style?: StyleProp<TextStyle>;
  durationMs?: number;
}

/**
 * A number that rolls to its new value instead of jumping. Rendered through
 * a non-editable TextInput so the text can update on the UI thread.
 */
export function CountUp({
  value,
  prefix = "",
  decimals = 2,
  style,
  durationMs = 800,
}: CountUpProps) {
  const sv = useSharedValue(value);

  useEffect(() => {
    sv.value = withTiming(value, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, durationMs, sv]);

  const animatedProps = useAnimatedProps(() => {
    const fixed = sv.value.toFixed(decimals);
    const dot = fixed.indexOf(".");
    const intPart = dot === -1 ? fixed : fixed.slice(0, dot);
    const decPart = dot === -1 ? "" : fixed.slice(dot);
    let grouped = "";
    for (let i = 0; i < intPart.length; i++) {
      const fromEnd = intPart.length - i;
      grouped += intPart[i];
      if (fromEnd > 1 && (fromEnd - 1) % 3 === 0 && intPart[i] !== "-") {
        grouped += ",";
      }
    }
    return { text: `${prefix}${grouped}${decPart}` } as any;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      defaultValue={`${prefix}${value.toFixed(decimals)}`}
      animatedProps={animatedProps}
      style={[{ padding: 0 }, style]}
    />
  );
}
