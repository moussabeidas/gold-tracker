import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Line, Circle, G, Rect } from "react-native-svg";

import Colors from "@/constants/colors";
import {
  WORLD_LAND_PATH,
  WORLD_MAP_WIDTH,
  WORLD_MAP_HEIGHT,
} from "@/constants/worldMap";
import { WorldEvent, CATEGORY_META } from "@/hooks/useWorldEvents";

// PYTHIA-style global map: dark equirectangular world with live event
// markers sized by salience. Tap a marker to select its event.

interface WorldMapProps {
  width: number;
  events: WorldEvent[];
  selectedId?: string | null;
  onSelect?: (event: WorldEvent) => void;
}

function project(lat: number, lng: number): { x: number; y: number } {
  return { x: lng + 180, y: 90 - lat };
}

const GRATICULE_STEP = 30;

export function WorldMap({ width, events, selectedId, onSelect }: WorldMapProps) {
  const height = width / 2;

  const graticule = useMemo(() => {
    const lines: React.ReactElement[] = [];
    for (let lng = GRATICULE_STEP; lng < 360; lng += GRATICULE_STEP) {
      lines.push(
        <Line
          key={`v${lng}`}
          x1={lng}
          y1={0}
          x2={lng}
          y2={WORLD_MAP_HEIGHT}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.4}
        />,
      );
    }
    for (let lat = GRATICULE_STEP; lat < 180; lat += GRATICULE_STEP) {
      lines.push(
        <Line
          key={`h${lat}`}
          x1={0}
          y1={lat}
          x2={WORLD_MAP_WIDTH}
          y2={lat}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.4}
        />,
      );
    }
    return lines;
  }, []);

  // Selected marker drawn last so its highlight ring sits on top.
  const ordered = useMemo(() => {
    if (!selectedId) return events;
    const rest = events.filter((e) => e.id !== selectedId);
    const sel = events.find((e) => e.id === selectedId);
    return sel ? [...rest, sel] : rest;
  }, [events, selectedId]);

  return (
    <View style={styles.container}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
      >
        <Rect
          x={0}
          y={0}
          width={WORLD_MAP_WIDTH}
          height={WORLD_MAP_HEIGHT}
          fill={Colors.dark.surface}
        />
        {graticule}
        <Path
          d={WORLD_LAND_PATH}
          fill="#232327"
          stroke="rgba(255,215,0,0.18)"
          strokeWidth={0.3}
        />
        {ordered.map((ev) => {
          const { x, y } = project(ev.lat, ev.lng);
          const color = CATEGORY_META[ev.category].color;
          const r = 1.4 + ev.salience * 2.2;
          const isSelected = ev.id === selectedId;
          return (
            <G key={ev.id}>
              {(ev.salience >= 0.8 || isSelected) && (
                <Circle cx={x} cy={y} r={r + 2.4} fill={color} opacity={0.18} />
              )}
              <Circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                opacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? Colors.dark.text : "rgba(0,0,0,0.5)"}
                strokeWidth={isSelected ? 0.7 : 0.3}
              />
              {/* enlarged invisible hit target */}
              <Circle
                cx={x}
                cy={y}
                r={Math.max(r + 4, 6)}
                fill="transparent"
                onPress={onSelect ? () => onSelect(ev) : undefined}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.dark.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
});
