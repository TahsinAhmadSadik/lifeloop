import { describe, expect, it } from "vitest";
import { calculateBmi, inchesToCm, poundsToKg } from "../health";
import { computeBaseline, median, medianAbsoluteDeviation, updateBaseline } from "./baseline";
import { deriveBmiContext } from "./body-metrics";
import { calibrateAlertThreshold, compareFixedThreshold, runCusum } from "./cusum";
import { ENGINE_CONFIG } from "./config";
import { evaluatePatient } from "./evaluate";
import { signalState } from "./state";
import { trustScore, validateEngineReading } from "./trust";
import type { CoreSignal, EngineReading, EngineSignal, EngineUnit, ScoredReading, SignalBaseline } from "./types";

const day = ENGINE_CONFIG.time.dayMs;
const units: Record<EngineSignal, EngineUnit> = {
  systolic: "mmHg",
  diastolic: "mmHg",
  glucose: "mg/dL",
  height: "cm",
  weight: "kg",
};

function reading(
  signal: EngineSignal,
  value: number,
  observedAtMs: number,
  overrides: Partial<EngineReading> = {},
): EngineReading {
  return {
    id: `${signal}-${observedAtMs}-${value}`,
    patientId: "patient-a",
    observedAtMs,
    signal,
    value,
    unit: units[signal],
    source: "device-import",
    protocolConfirmed: true,
    ...overrides,
  };
}

function scored(item: EngineReading, score = 1): ScoredReading {
  return { reading: item, trust: { score, floorApplied: false, breakdown: [] } };
}

function baseline(signal: CoreSignal, center = 120, spread = 5): SignalBaseline {
  return {
    signal,
    window: { startMs: 0, endMs: 14 * day },
    center,
    mad: spread / ENGINE_CONFIG.baseline.madScale,
    spread,
    usableCount: 14,
    frozen: false,
  };
}

describe("trust score", () => {
  it("applies only the relevant multiplicative penalties and reports each factor", () => {
    const previous = reading("systolic", 100, day);
    const current = reading("systolic", 150, day + 30 * 60 * 1000, {
      source: "patient-entered",
      protocolConfirmed: false,
      repeatWithinFiveMinutes: false,
    });
    const result = trustScore(current, { previousReading: previous });

    expect(result.score).toBeCloseTo(0.85 * 0.6 * 0.8 * 0.9);
    expect(result.breakdown.filter((item) => item.applied).map((item) => item.key)).toEqual([
      "missing-bp-repeat",
      "implausible-jump",
      "protocol-unconfirmed",
      "patient-entered",
    ]);
  });

  it("detects heavy manual terminal-digit preference and low-confidence edited OCR", () => {
    const history = Array.from({ length: 10 }, (_, index) => reading("glucose", index % 2 ? 105 : 110, index * day, { source: "patient-entered" }));
    const current = reading("glucose", 115, 10 * day, { source: "patient-entered" });
    expect(trustScore(current, { recentReadings: history }).breakdown.find((item) => item.key === "terminal-digit-preference")?.applied).toBe(true);

    const editedPhoto = reading("glucose", 115, 11 * day, {
      source: "photo-import (confirmed)",
      ocrEdited: true,
      ocrConfidence: 0.5,
    });
    expect(trustScore(editedPhoto).breakdown.find((item) => item.key === "edited-low-confidence-photo")?.factor).toBe(0.9);
  });

  it("validates units and keeps trust within the configured floor and ceiling", () => {
    expect(() => validateEngineReading(reading("glucose", 90, 0, { unit: "mmHg" }))).toThrow(/does not match/);
    const result = trustScore(reading("systolic", 120, 0));
    expect(result.score).toBeGreaterThanOrEqual(ENGINE_CONFIG.trust.floor);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe("robust causal baseline", () => {
  it("uses median and scaled MAD, excludes low-trust values and the exclusive end", () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(medianAbsoluteDeviation([1, 9, 3])).toBe(2);
    const samples = [
      scored(reading("systolic", 100, 0)),
      scored(reading("systolic", 101, day)),
      scored(reading("systolic", 102, 2 * day)),
      scored(reading("systolic", 103, 3 * day)),
      scored(reading("systolic", 1000, 4 * day), 0.2),
      scored(reading("systolic", 999, 5 * day)),
    ];
    const result = computeBaseline(samples, "systolic", { startMs: 0, endMs: 5 * day });

    expect(result.center).toBe(101.5);
    expect(result.usableCount).toBe(4);
    expect(result.spread).toBeGreaterThanOrEqual(ENGINE_CONFIG.baseline.madFloor.systolic);
  });

  it("freezes the previous reference while drift is active", () => {
    const initial = computeBaseline([scored(reading("systolic", 120, 0))], "systolic", { startMs: 0, endMs: day });
    const frozen = updateBaseline(initial, [scored(reading("systolic", 140, 2 * day))], "systolic", { startMs: day, endMs: 3 * day }, true);

    expect(frozen.center).toBe(initial.center);
    expect(frozen.window).toEqual(initial.window);
    expect(frozen.frozen).toBe(true);
  });
});

describe("pattern states and drift", () => {
  it("does not call sparse history normal and moves through the learning boundary", () => {
    const asOf = 20 * day;
    const six = Array.from({ length: 6 }, (_, index) => scored(reading("glucose", 100, asOf - index * day)));
    const eleven = Array.from({ length: 11 }, (_, index) => scored(reading("glucose", 100, asOf - index * day)));
    const twelve = Array.from({ length: 12 }, (_, index) => scored(reading("glucose", 100, asOf - index * day)));

    expect(signalState("glucose", six.slice(0, 4), asOf, false, true).state).toBe("Not enough data");
    expect(signalState("glucose", six, asOf, false, true).state).toBe("Learning your pattern");
    expect(signalState("glucose", eleven, asOf, false, true).state).toBe("Learning your pattern");
    expect(signalState("glucose", twelve, asOf, false, true).state).toBe("Within your recent pattern");
    expect(signalState("glucose", twelve, asOf, true, true).state).toBe("Repeated change to review");
  });

  it("raises the upward CUSUM on repeated shifts and widens uncertainty for low trust/coverage", () => {
    const reference = baseline("systolic");
    const stable = Array.from({ length: 8 }, (_, index) => scored(reading("systolic", 120, (15 + index) * day)));
    const rising = Array.from({ length: 8 }, (_, index) => scored(reading("systolic", 129, (15 + index) * day)));
    const full = runCusum("systolic", stable, reference, 1, 4, 30 * day);
    const shifted = runCusum("systolic", rising, reference, 1, 4, 30 * day);
    const uncertain = runCusum("systolic", rising.map(({ reading: item }) => scored(item, 0.5)), reference, 0.5, 4, 30 * day);

    expect(full.finalScore).toBe(0);
    expect(shifted.active).toBe(true);
    expect(uncertain.points[0].uncertaintyUpper - uncertain.points[0].uncertaintyLower)
      .toBeGreaterThan(shifted.points[0].uncertaintyUpper - shifted.points[0].uncertaintyLower);
  });
});

describe("fixed comparator and calibration", () => {
  it("uses strict single-reading limits and ignores body metrics", () => {
    const results = compareFixedThreshold([
      reading("systolic", ENGINE_CONFIG.demoFixedLimits.systolic, 0),
      reading("diastolic", ENGINE_CONFIG.demoFixedLimits.diastolic + 1, day),
      reading("weight", 70, day),
    ]);
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.exceeded)).toEqual([false, true]);
  });

  it("selects the lowest null-cohort threshold meeting the configured budget", () => {
    const calibrated = calibrateAlertThreshold([
      { patientId: "a", observedDays: 30, cusumScores: [0, 2, 0, 2, 0] },
      { patientId: "b", observedDays: 30, cusumScores: [0, 2, 0] },
    ], [2, 4], 1);
    expect(calibrated.h).toBe(4);
    expect(calibrated.targetMet).toBe(true);
  });
});

describe("BMI context", () => {
  it("calculates BMI only when valid confirmed height and weight exist, without alert eligibility", () => {
    expect(poundsToKg(154)).toBeCloseTo(69.853);
    expect(inchesToCm(70)).toBe(177.8);
    expect(calculateBmi(70, 175)).toBeCloseTo(22.857, 2);
    expect(calculateBmi(70, 0)).toBeNull();

    const context = deriveBmiContext([
      scored(reading("height", 175, 0)),
      scored(reading("weight", 70, day)),
    ], day);
    expect(context.bmi).toBeCloseTo(22.857, 2);
    expect(context.alertEligible).toBe(false);
    expect(deriveBmiContext([scored(reading("weight", 70, day))], day).bmi).toBeNull();
  });
});

describe("patient evaluation", () => {
  it("forms the initial reference only from days 1-14 and ignores future records", () => {
    const timeline: EngineReading[] = [];
    const signals: readonly CoreSignal[] = ["systolic", "diastolic", "glucose"];
    for (let index = 0; index < 14; index += 1) {
      for (const signal of signals) {
        const value = signal === "systolic" ? 120 : signal === "diastolic" ? 80 : 100;
        timeline.push(reading(signal, value, index * day));
      }
    }
    timeline.push(reading("systolic", 200, 15 * day));

    const evaluated = evaluatePatient(timeline, 14 * day);
    expect(evaluated.baselines.find((item) => item.signal === "systolic")?.usableCount).toBe(14);
    expect(evaluated.fixedThresholds.some((item) => item.value === 200)).toBe(false);
    expect(evaluated.bmiContext.alertEligible).toBe(false);
  });

  it("rejects mixed-patient timelines", () => {
    expect(() => evaluatePatient([
      reading("systolic", 120, 0),
      reading("systolic", 121, day, { patientId: "patient-b" }),
    ], day)).toThrow(/one patient/);
  });
});
