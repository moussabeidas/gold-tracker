import React from "react";
import { Coin3D } from "@/components/Coin3D";

interface SpinningCoinProps {
  size?: number;
  /** Milliseconds per full turn */
  periodMs?: number;
}

/**
 * The app's coin turning slowly and steadily in 3D — with real thickness
 * and a reeded rim (see Coin3D). Runs entirely on the UI thread.
 */
export function SpinningCoin({ size = 96, periodMs = 7000 }: SpinningCoinProps) {
  return <Coin3D size={size} periodMs={periodMs} />;
}
