import { useCallback, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Adaptive top padding for tab screens under native tabs.
 *
 * Depending on device / iOS version, the native tab container either gives
 * screens the full display (content must pad past the status bar) or a
 * frame already inset below it (padding again doubles the gap — seen as a
 * dead band on some devices). Instead of hardcoding per-device constants,
 * measure where the screen's frame actually starts in the window and only
 * add the difference.
 *
 * Usage:
 *   const { topPad, onLayout } = useAdaptiveTopPad(16);
 *   <ScrollView onLayout={onLayout} contentContainerStyle={{ paddingTop: topPad }} …
 */
export function useAdaptiveTopPad(extra: number): {
  topPad: number;
  onLayout: (event: { target?: unknown }) => void;
} {
  const insets = useSafeAreaInsets();
  const [frameTop, setFrameTop] = useState<number | null>(null);
  const measured = useRef(false);

  const onLayout = useCallback((event: { target?: unknown }) => {
    if (measured.current || Platform.OS === "web") return;
    const node = event.target as
      | { measureInWindow?: (cb: (x: number, y: number) => void) => void }
      | undefined;
    node?.measureInWindow?.((_x, y) => {
      if (isFinite(y) && y >= 0) {
        measured.current = true;
        setFrameTop(y);
      }
    });
  }, []);

  if (Platform.OS === "web") {
    return { topPad: insets.top + 67, onLayout };
  }

  // Until measured (first frame), assume the frame is full-bleed — the
  // classic behavior — then correct. The correction only ever shrinks the
  // gap, so there is no visible jump on devices that were already right.
  const alreadyInset = Math.min(frameTop ?? 0, insets.top);
  const topPad = Math.max(insets.top - alreadyInset, 0) + extra;
  return { topPad, onLayout };
}

export type MeasurableView = View;
