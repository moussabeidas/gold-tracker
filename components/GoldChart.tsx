import React, { useState, useCallback, useMemo, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from "react-native-svg";
import { PanResponder } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { PricePoint } from "@/hooks/useGoldData";
import Colors from "@/constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_HEIGHT = 200;
// Rendering more segments than ~2 per pt of width is invisible — thin the
// series before building the path so intraday (390 points) stays cheap.
const MAX_PATH_POINTS = 140;
const HALO_SIZE = 30;

function thin(data: PricePoint[]): PricePoint[] {
  if (data.length <= MAX_PATH_POINTS) return data;
  const stride = Math.ceil(data.length / MAX_PATH_POINTS);
  const out: PricePoint[] = [];
  for (let i = 0; i < data.length; i += stride) out.push(data[i]);
  if (out[out.length - 1] !== data[data.length - 1]) {
    out.push(data[data.length - 1]);
  }
  return out;
}

function buildPaths(data: PricePoint[], chartW: number, chartH: number) {
  if (!data.length) return { path: "", areaPath: "", endY: null as number | null };
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = range * 0.1;

  const toX = (i: number) => (i / (data.length - 1)) * chartW;
  const toY = (p: number) =>
    chartH - ((p - (min - pad)) / (range + pad * 2)) * chartH;

  let d = `M ${toX(0).toFixed(1)} ${toY(data[0].price).toFixed(1)}`;
  for (let i = 1; i < data.length; i++) {
    const x0 = toX(i - 1);
    const y0 = toY(data[i - 1].price);
    const x1 = toX(i);
    const y1 = toY(data[i].price);
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx.toFixed(1)} ${y0.toFixed(1)} ${cpx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return {
    path: d,
    areaPath: `${d} L ${chartW} ${chartH} L 0 ${chartH} Z`,
    endY: toY(data[data.length - 1].price),
  };
}

interface GoldChartProps {
  data: PricePoint[];
  isPositive: boolean;
  onScrub?: (price: number | null, index: number | null) => void;
}

// Breathing halo rendered as a plain Animated.View overlay — animating SVG
// props at 60fps was the main-screen scroll killer; view transforms run
// natively on the UI thread with zero per-frame prop traffic.
function EndpointHalo({ color, x, y }: { color: string; x: number; y: number }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1
    );
  }, [breathe]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - breathe.value),
    transform: [{ scale: 0.25 + breathe.value * 0.75 }],
  }));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.haloAnchor,
        { left: x - HALO_SIZE / 2, top: y - HALO_SIZE / 2 },
      ]}
    >
      <Animated.View style={[styles.halo, { backgroundColor: color }, haloStyle]} />
      <View style={[styles.endDot, { backgroundColor: color }]} />
    </View>
  );
}

function GoldChartInner({ data, isPositive, onScrub }: GoldChartProps) {
  const [scrubX, setScrubX] = useState<number | null>(null);
  const chartW = SCREEN_W;

  const { path, areaPath, endY } = useMemo(
    () => buildPaths(thin(data), chartW, CHART_HEIGHT),
    [data, chartW]
  );

  const lineColor = isPositive ? Colors.dark.positive : Colors.dark.negative;
  const gradientColor = isPositive
    ? "rgba(48, 209, 88, 0.25)"
    : "rgba(255, 69, 58, 0.25)";

  const getIndexForX = useCallback(
    (x: number) => {
      if (!data.length) return 0;
      const ratio = Math.min(Math.max(x / chartW, 0), 1);
      return Math.round(ratio * (data.length - 1));
    },
    [data, chartW]
  );

  const getScrubY = useCallback(
    (index: number) => {
      if (!data.length || index < 0 || index >= data.length) return null;
      const prices = data.map((d) => d.price);
      const localMin = Math.min(...prices);
      const localMax = Math.max(...prices);
      const range = localMax - localMin || 1;
      const pad = range * 0.1;
      const p = data[index].price;
      return (
        CHART_HEIGHT -
        ((p - (localMin - pad)) / (range + pad * 2)) * CHART_HEIGHT
      );
    },
    [data]
  );

  // Claim the gesture only for horizontal drags so vertical scrolling
  // that starts on the chart passes through to the ScrollView.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gs) =>
          Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX;
          setScrubX(x);
          const idx = getIndexForX(x);
          onScrub?.(data[idx]?.price ?? null, idx);
        },
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.locationX;
          setScrubX(x);
          const idx = getIndexForX(x);
          onScrub?.(data[idx]?.price ?? null, idx);
        },
        onPanResponderRelease: () => {
          setScrubX(null);
          onScrub?.(null, null);
        },
        onPanResponderTerminate: () => {
          setScrubX(null);
          onScrub?.(null, null);
        },
      }),
    [data, getIndexForX, onScrub]
  );

  const scrubIndex = scrubX !== null ? getIndexForX(scrubX) : null;
  const scrubY = scrubIndex !== null ? getScrubY(scrubIndex) : null;

  return (
    <Animated.View
      entering={FadeIn.duration(450)}
      style={[styles.container, { width: chartW }]}
      {...panResponder.panHandlers}
    >
      <Svg width={chartW} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={gradientColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={areaPath} fill="url(#areaGrad)" />
        <Path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {scrubX !== null && scrubY !== null && (
          <>
            <Line
              x1={scrubX}
              y1={0}
              x2={scrubX}
              y2={CHART_HEIGHT}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <Circle
              cx={scrubX}
              cy={scrubY}
              r={5}
              fill={lineColor}
              strokeWidth={2}
              stroke={Colors.dark.background}
            />
          </>
        )}
      </Svg>

      {scrubX === null && endY !== null && (
        <EndpointHalo color={lineColor} x={chartW - 3} y={endY} />
      )}
    </Animated.View>
  );
}

export const GoldChart = React.memo(GoldChartInner);

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
  },
  haloAnchor: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HALO_SIZE / 2,
  },
  endDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
