import { ENGINE_CONFIG } from "./config";
import type { CoreSignal, EngineStateName, ScoredReading, SignalState } from "./types";

export function signalState(
  signal: CoreSignal,
  scoredReadings: readonly ScoredReading[],
  asOfMs: number,
  driftActive: boolean,
  baselineReady: boolean,
): SignalState {
  const startMs = asOfMs - ENGINE_CONFIG.baseline.stateWindowDays * ENGINE_CONFIG.time.dayMs;
  const usable = scoredReadings.filter(({ reading, trust }) => reading.signal === signal
    && reading.observedAtMs >= startMs
    && reading.observedAtMs <= asOfMs
    && trust.score >= ENGINE_CONFIG.baseline.minimumTrust);
  const expectedReadings = ENGINE_CONFIG.baseline.expectedReadingsPerDay[signal] * ENGINE_CONFIG.baseline.stateWindowDays;
  const coverage = Math.min(1, usable.length / expectedReadings);
  let state: EngineStateName;
  let reason: string;

  if (usable.length < ENGINE_CONFIG.baseline.notEnoughBelow) {
    state = "Not enough data";
    reason = `Only ${usable.length} usable ${signal} readings are available in the last ${ENGINE_CONFIG.baseline.stateWindowDays} days.`;
  } else if (usable.length <= ENGINE_CONFIG.baseline.learningMaximum || !baselineReady) {
    state = "Learning your pattern";
    reason = !baselineReady
      ? `The causal ${ENGINE_CONFIG.baseline.initialReferenceDays}-day reference window is not ready for ${signal}.`
      : `The reference is still learning from ${usable.length} usable ${signal} readings.`;
  } else if (driftActive) {
    state = "Repeated change to review";
    reason = `The one-sided demo CUSUM for ${signal} crossed its configured review threshold.`;
  } else {
    state = "Within your recent pattern";
    reason = `No configured upward sample-pattern shift was found for ${signal} in this evaluation window.`;
  }

  return {
    signal,
    state,
    reason,
    period: { startMs, endMs: asOfMs },
    measuresUsed: [signal],
    usableReadings: usable.length,
    expectedReadings,
    coverage,
  };
}

export function overallState(signalStates: readonly SignalState[]): { state: EngineStateName; reason: string } {
  const changed = signalStates.filter((item) => item.state === "Repeated change to review");
  if (changed.length) return { state: "Repeated change to review", reason: `Repeated sample-pattern change in: ${changed.map((item) => item.signal).join(", ")}.` };
  const insufficient = signalStates.filter((item) => item.state === "Not enough data");
  if (insufficient.length) return { state: "Not enough data", reason: `Not enough usable data for: ${insufficient.map((item) => item.signal).join(", ")}.` };
  const learning = signalStates.filter((item) => item.state === "Learning your pattern");
  if (learning.length) return { state: "Learning your pattern", reason: `Still learning: ${learning.map((item) => item.signal).join(", ")}.` };
  return { state: "Within your recent pattern", reason: "No configured upward sample-pattern shift was detected." };
}
