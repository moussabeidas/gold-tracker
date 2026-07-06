import React, { useRef, useState } from "react";
import { View, StyleSheet, Alert, Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ShareCard, type ShareCardData } from "@/components/ShareCard";
import { track } from "@/lib/analytics";

export function ShareGoldButton({ data }: { data: ShareCardData }) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    track("share_price");
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      // Two frames so the off-screen card is laid out before capture
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share the gold price",
        });
      }
    } catch {
      Alert.alert("Couldn't create image", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AnimatedPressable
        scaleDown={0.88}
        onPress={handleShare}
        hitSlop={10}
        style={styles.button}
      >
        <Feather name="share" size={18} color={Colors.dark.gold} />
      </AnimatedPressable>

      {/* Off-screen card that gets captured. Kept laid out (not display:none)
          so react-native-view-shot can snapshot it on demand. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={cardRef} data={data} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  offscreen: {
    position: "absolute",
    left: Platform.OS === "web" ? -9999 : 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
});
