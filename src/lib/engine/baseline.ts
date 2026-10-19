import { ENGINE_CONFIG } from "./config";
import type { BaselineWindow, CoreSignal, ScoredReading, SignalBaseline } from "./types";

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function medianAbsoluteDeviation(values: readonly number[], center = median(values)): number | null {
  if (center === null) return null;
  return median(values.map((value) => Math.abs(value - center)));
}

export function computeBaseline(scoredReadings: readonly ScoredReading[], signal: CoreSignal, window: BaselineWindow): SignalBaseline {
  if (!Number.isFinite(window.startMs) || !Number.isFinite(window.endMs) || window.endMs <= window.startMs) {
    throw new Error("Baseline window must have finite positive duration.");
  }
  const values = scoredReadings
    .filter(({ reading, trust }) => reading.signal === signal
      && reading.observedAtMs >= window.startMs
      && reading.observedAtMs < window.endMs
      && trust.score >= ENGINE_CONFIG.baseline.minimumTrust)
    .map(({ reading }) => reading.value);
  const center = median(values);
  const mad = medianAbsoluteDeviation(values, center);
  const spread = mad === null ? null : Math.max(mad * ENGINE_CONFIG.baseline.madScale, ENGINE_CONFIG.baseline.madFloor[signal]);
  return { signal, window, center, mad, spread, usableCount: values.length, frozen: false };
}

/** A drift-active snapshot is returned unchanged and marked frozen. */
export function updateBaseline(
  previous: SignalBaseline | null,
  candidateReadings: readonly ScoredReading[],
  signal: CoreSignal,
  candidateWindow: BaselineWindow,
  driftActive: boolean,
): SignalBaseline {
  if (previous && driftActive) return { ...previous, frozen: true };
  return computeBaseline(candidateReadings, signal, candidateWindow);
}
