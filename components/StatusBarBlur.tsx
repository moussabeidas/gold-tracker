import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, View, Platform } from "react-native";

export function StatusBarBlur() {
  const insets = useSafeAreaInsets();

  // Nothing to cover on web (no native status bar)
  if (Platform.OS === "web" || insets.top === 0) return null;

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={60}
        tint="dark"
        style={[styles.bar, { height: insets.top }]}
        pointerEvents="none"
      />
    );
  }

  // Android: simple dark scrim
  return (
    <View
      style={[styles.bar, { height: insets.top, backgroundColor: "rgba(0,0,0,0.55)" }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
