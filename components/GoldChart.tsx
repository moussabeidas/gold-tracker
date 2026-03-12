import React, { useState, useCallback } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Rect,
} from "react-native-svg";
import { PanResponder } from "react-native";
import { PricePoint } from "@/hooks/useGoldData";
import Colors from "@/constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_HEIGHT = 200;
const PADDING_HORIZONTAL = 0;

function buildPath(
  data: PricePoint[],
  chartW: number,
  chartH: number
): { path: string; min: number; max: number } {
  if (!data.length) return { path: "", min: 0, max: 0 };
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = range * 0.1;

  const toX = (i: number) => (i / (data.length - 1)) * chartW;
  const toY = (p: number) =>
    chartH - ((p - (min - pad)) / (range + pad * 2)) * chartH;

  let d = `M ${toX(0)} ${toY(data[0].price)}`;
  for (let i = 1; i < data.length; i++) {
    const x0 = toX(i - 1);
    const y0 = toY(data[i - 1].price);
    const x1 = toX(i);
    const y1 = toY(data[i].price);
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx} ${y0} ${cpx} ${y1} ${x1} ${y1}`;
  }
  return { path: d, min, max };
}

function buildAreaPath(linePath: string, chartW: number, chartH: number) {
  if (!linePath) return "";
  return `${linePath} L ${chartW} ${chartH} L 0 ${chartH} Z`;
}

interface GoldChartProps {
  data: PricePoint[];
  isPositive: boolean;
  onScrub?: (price: number | null, index: number | null) => void;
}

export function GoldChart({ data, isPositive, onScrub }: GoldChartProps) {
  const [scrubX, setScrubX] = useState<number | null>(null);
  const chartW = SCREEN_W - PADDING_HORIZONTAL * 2;
  const { path, min, max } = buildPath(data, chartW, CHART_HEIGHT);
  const areaPath = buildAreaPath(path, chartW, CHART_HEIGHT);

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

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
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
  });

  const scrubIndex = scrubX !== null ? getIndexForX(scrubX) : null;
  const scrubY =
    scrubIndex !== null ? getScrubY(scrubIndex) : null;

  return (
    <View style={[styles.container, { width: chartW }]} {...panResponder.panHandlers}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
  },
});
