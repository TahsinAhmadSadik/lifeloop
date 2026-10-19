import { calculateBmi } from "../health";
import type { BmiContext, ScoredReading } from "./types";

/** BMI is adult screening context only; this derived value is never alert-eligible. */
export function deriveBmiContext(scoredReadings: readonly ScoredReading[], asOfMs: number): BmiContext {
  const eligible = scoredReadings.filter(({ reading }) => reading.observedAtMs <= asOfMs);
  const latestWeight = eligible.filter(({ reading }) => reading.signal === "weight" && reading.unit === "kg")
    .sort((a, b) => b.reading.observedAtMs - a.reading.observedAtMs)[0];
  const latestHeight = eligible.filter(({ reading }) => reading.signal === "height"
    && reading.unit === "cm"
    && (!latestWeight || reading.observedAtMs <= latestWeight.reading.observedAtMs))
    .sort((a, b) => b.reading.observedAtMs - a.reading.observedAtMs)[0];

  if (!latestHeight || !latestWeight) {
    return { bmi: null, heightReadingId: latestHeight?.reading.id ?? null, weightReadingId: latestWeight?.reading.id ?? null, trust: null, alertEligible: false };
  }
  return {
    bmi: calculateBmi(latestWeight.reading.value, latestHeight.reading.value),
    heightReadingId: latestHeight.reading.id,
    weightReadingId: latestWeight.reading.id,
    trust: Math.min(latestHeight.trust.score, latestWeight.trust.score),
    alertEligible: false,
  };
}
