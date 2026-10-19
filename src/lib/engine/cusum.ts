import { ENGINE_CONFIG } from "./config";
import type { AlertCalibrationResult, CoreSignal, CusumPoint, CusumResult, EngineReading, FixedThresholdResult, NullPatientTrace, ScoredReading, SignalBaseline } from "./types";

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

export function runCusum(
  signal: CoreSignal,
  scoredReadings: readonly ScoredReading[],
  baseline: SignalBaseline,
  coverage: number,
  h = ENGINE_CONFIG.cusum.initialH,
  asOfMs = Number.POSITIVE_INFINITY,
): CusumResult {
  if (!Number.isFinite(h) || h <= 0) throw new Error("CUSUM h must be positive and finite.");
  const events = scoredReadings
    .filter(({ reading }) => reading.signal === signal && reading.observedAtMs >= baseline.window.endMs && reading.observedAtMs <= asOfMs)
    .sort((a, b) => a.reading.observedAtMs - b.reading.observedAtMs);
  const baselineReady = baseline.center !== null && baseline.spread !== null
    && baseline.usableCount >= ENGINE_CONFIG.baseline.minimumUsableForBaseline;
  if (!baselineReady) return { signal, h, active: false, finalScore: 0, points: [], coverage: clamp01(coverage), meanTrust: 0 };

  let score = 0;
  let trustTotal = 0;
  const points: CusumPoint[] = [];
  for (const { reading, trust } of events) {
    const robustZ = (reading.value - baseline.center!) / baseline.spread!;
    const weightedZ = robustZ * trust.score;
    score = Math.max(0, score + weightedZ - ENGINE_CONFIG.cusum.k);
    trustTotal += trust.score;
    const evidence = clamp01(trust.score * coverage);
    const uncertaintyWidth = baseline.spread! * (1 + ENGINE_CONFIG.cusum.uncertaintyWidening * (1 - evidence));
    points.push({
      readingId: reading.id,
      observedAtMs: reading.observedAtMs,
      value: reading.value,
      trust: trust.score,
      robustZ,
      weightedZ,
      score,
      uncertaintyLower: baseline.center! - uncertaintyWidth,
      uncertaintyUpper: baseline.center! + uncertaintyWidth,
    });
  }

  return {
    signal,
    h,
    active: score >= h,
    finalScore: score,
    points,
    coverage: clamp01(coverage),
    meanTrust: points.length ? trustTotal / points.length : 0,
  };
}

function countEpisodes(scores: readonly number[], h: number): number {
  let above = false;
  let episodes = 0;
  for (const score of scores) {
    if (!above && score >= h) {
      above = true;
      episodes += 1;
    } else if (above && score < h * ENGINE_CONFIG.alertBudget.episodeResetBelowFractionOfH) {
      above = false;
    }
  }
  return episodes;
}

/** Calibrate on null-only traces; evaluate the selected h on a separate held-out cohort. */
export function calibrateAlertThreshold(
  nullCohort: readonly NullPatientTrace[],
  candidateHs: readonly number[] = ENGINE_CONFIG.cusum.candidateH,
  targetAlertsPerPatientMonth = ENGINE_CONFIG.alertBudget.targetFalseAlertsPerPatientMonth,
): AlertCalibrationResult {
  if (!nullCohort.length) throw new Error("Calibration requires a non-empty null cohort.");
  if (!Number.isFinite(targetAlertsPerPatientMonth) || targetAlertsPerPatientMonth < 0) throw new Error("Alert budget must be non-negative.");
  if (!candidateHs.length || candidateHs.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("CUSUM candidates must be positive and finite.");
  const patientMonths = nullCohort.reduce((sum, patient) => sum + Math.max(0, patient.observedDays), 0) / ENGINE_CONFIG.alertBudget.daysPerMonth;
  if (patientMonths <= 0) throw new Error("Null cohort must contain observed patient-days.");

  const scores = [...candidateHs].sort((a, b) => a - b).map((h) => {
    const alerts = nullCohort.reduce((sum, patient) => sum + countEpisodes(patient.cusumScores, h), 0);
    const alertsPerPatientMonth = alerts / patientMonths;
    return { h, alerts, patientMonths, alertsPerPatientMonth, targetMet: alertsPerPatientMonth <= targetAlertsPerPatientMonth };
  });
  return { ...(scores.find((item) => item.targetMet) ?? scores[scores.length - 1]), targetAlertsPerPatientMonth };
}

export function compareFixedThreshold(readings: readonly EngineReading[]): FixedThresholdResult[] {
  const limits: Record<CoreSignal, number> = {
    systolic: ENGINE_CONFIG.demoFixedLimits.systolic,
    diastolic: ENGINE_CONFIG.demoFixedLimits.diastolic,
    glucose: ENGINE_CONFIG.demoFixedLimits.glucoseMgDl,
  };
  return readings.filter((reading) => reading.signal === "systolic" || reading.signal === "diastolic" || reading.signal === "glucose").map((reading) => {
    const signal = reading.signal as CoreSignal;
    const limit = limits[signal];
    return { readingId: reading.id, signal, value: reading.value, limit, exceeded: reading.value > limit };
  });
}
