import { ENGINE_CONFIG } from "./config";
import { deriveBmiContext } from "./body-metrics";
import { computeBaseline, updateBaseline } from "./baseline";
import { compareFixedThreshold, runCusum } from "./cusum";
import { overallState, signalState } from "./state";
import { trustScore, validateEngineReading } from "./trust";
import type { CoreSignal, EngineReading, PatientEngineResult, ScoredReading } from "./types";

const coreSignals: readonly CoreSignal[] = ["systolic", "diastolic", "glucose"];
function scoreTimeline(readings: readonly EngineReading[]): ScoredReading[] {
  const ordered = [...readings].sort((a, b) => a.observedAtMs - b.observedAtMs);
  if (new Set(ordered.map((reading) => reading.patientId)).size > 1) throw new Error("Evaluate one patient timeline at a time.");
  ordered.forEach(validateEngineReading);

  return ordered.map((reading, index) => {
    const history = ordered.slice(0, index).filter((candidate) => candidate.signal === reading.signal && candidate.patientId === reading.patientId);
    return { reading, trust: trustScore(reading, { previousReading: history[history.length - 1], recentReadings: history }) };
  });
}

export function evaluatePatient(readings: readonly EngineReading[], asOfMs: number, h = ENGINE_CONFIG.cusum.initialH): PatientEngineResult {
  if (!Number.isFinite(asOfMs)) throw new Error("Evaluation time must be finite.");
  const scored = scoreTimeline(readings.filter((reading) => reading.observedAtMs <= asOfMs));
  const firstObservedMs = scored[0]?.reading.observedAtMs ?? asOfMs;
  const referenceWindow = {
    startMs: firstObservedMs,
    endMs: firstObservedMs + ENGINE_CONFIG.baseline.initialReferenceDays * ENGINE_CONFIG.time.dayMs,
  };
  const referenceReadyByTime = asOfMs >= referenceWindow.endMs;
  const baselines = coreSignals.map((signal) => computeBaseline(scored, signal, referenceWindow));

  const signalStates = coreSignals.map((signal, index) => {
    const stateWindowStart = asOfMs - ENGINE_CONFIG.baseline.stateWindowDays * ENGINE_CONFIG.time.dayMs;
    const usableCount = scored.filter(({ reading, trust }) => reading.signal === signal
      && reading.observedAtMs >= stateWindowStart
      && trust.score >= ENGINE_CONFIG.baseline.minimumTrust).length;
    const expected = ENGINE_CONFIG.baseline.expectedReadingsPerDay[signal] * ENGINE_CONFIG.baseline.stateWindowDays;
    const coverage = Math.min(1, usableCount / expected);
    const drift = runCusum(signal, scored, baselines[index], coverage, h, asOfMs);
    const baselineReady = referenceReadyByTime && baselines[index].usableCount >= ENGINE_CONFIG.baseline.minimumUsableForBaseline;
    return signalState(signal, scored, asOfMs, drift.active, baselineReady);
  });

  const cusum = coreSignals.map((signal, index) => {
    const state = signalStates[index];
    return runCusum(signal, scored, baselines[index], state.coverage, h, asOfMs);
  });
  const summary = overallState(signalStates);
  const baselineFrozen = cusum.some((result) => result.active);
  const outputBaselines = baselines.map((baseline, index) => updateBaseline(baseline, scored, baseline.signal, referenceWindow, cusum[index].active));

  return {
    evaluatedAtMs: asOfMs,
    overallState: summary.state,
    reason: summary.reason,
    signalStates,
    baselines: outputBaselines,
    cusum,
    topContributingSignals: cusum.filter((result) => result.active).sort((a, b) => b.finalScore - a.finalScore).map((result) => result.signal),
    fixedThresholds: compareFixedThreshold(scored.map((item) => item.reading)),
    bmiContext: deriveBmiContext(scored, asOfMs),
    baselineFrozen,
  };
}
