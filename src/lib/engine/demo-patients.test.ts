import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "./config";
import { evaluatePatient } from "./evaluate";
import { createDemoEnginePatients, DEMO_ENGINE_PATIENTS, getDemoEnginePatient } from "./demo-patients";
import { trustScore } from "./trust";

function evaluated(id: "rahim" | "stable" | "thin") {
  const patient = getDemoEnginePatient(id);
  return { patient, result: evaluatePatient(patient.readings, patient.evaluatedAtMs) };
}

describe("seeded synthetic engine patients", () => {
  it("is deterministic and labels each fixture as synthetic", () => {
    expect(createDemoEnginePatients()).toEqual(DEMO_ENGINE_PATIENTS);
    expect(DEMO_ENGINE_PATIENTS.every((patient) => patient.dataLabel === "Synthetic demo data")).toBe(true);
  });

  it("keeps Rahim below every fixed comparator while reporting repeated systolic change", () => {
    const { patient, result } = evaluated("rahim");
    const coreReadings = patient.readings.filter(({ signal }) => signal === "systolic" || signal === "diastolic" || signal === "glucose");
    const manualReadings = coreReadings.filter(({ source }) => source === "patient-entered");

    expect(patient.expectedCoreReadings).toBe(140);
    expect(patient.missingCoreReadings / patient.expectedCoreReadings).toBe(0.15);
    expect(coreReadings).toHaveLength(119);
    expect(new Set(manualReadings.map(({ observedAtMs }) => observedAtMs)).size).toBe(2);
    expect(manualReadings).toHaveLength(4);
    expect(manualReadings.every((reading) => trustScore(reading).score < 0.7)).toBe(true);
    expect(result.fixedThresholds.every((comparison) => !comparison.exceeded)).toBe(true);
    expect(result.overallState).toBe("Repeated change to review");
    expect(result.topContributingSignals).toContain("systolic");
    const startMs = Math.min(...patient.readings.map(({ observedAtMs }) => observedAtMs));
    const systolicValues = coreReadings.filter(({ signal }) => signal === "systolic");
    const referenceValues = systolicValues.filter(({ observedAtMs }) => observedAtMs < startMs + 14 * ENGINE_CONFIG.time.dayMs);
    const finalWeekValues = systolicValues.filter(({ observedAtMs }) => observedAtMs >= startMs + 21 * ENGINE_CONFIG.time.dayMs);
    const mean = (values: readonly { value: number }[]) => values.reduce((sum, item) => sum + item.value, 0) / values.length;
    expect(mean(referenceValues)).toBeGreaterThan(123);
    expect(mean(referenceValues)).toBeLessThan(129);
    expect(mean(finalWeekValues)).toBeGreaterThan(130);
    expect(mean(finalWeekValues)).toBeLessThan(137);
    expect(result.bmiContext.bmi).not.toBeNull();
    expect(result.bmiContext.alertEligible).toBe(false);
    expect(result.cusum.map(({ signal }) => signal)).not.toContain("height");
    expect(result.cusum.map(({ signal }) => signal)).not.toContain("weight");
  });

  it("keeps Stable free of a repeated-change state", () => {
    const { result } = evaluated("stable");

    expect(result.overallState).not.toBe("Repeated change to review");
    expect(result.fixedThresholds.every((comparison) => !comparison.exceeded)).toBe(true);
    expect(result.bmiContext.bmi).not.toBeNull();
    expect(result.bmiContext.alertEligible).toBe(false);
  });

  it("abstains for Thin's four readings instead of calling the pattern normal", () => {
    const { patient, result } = evaluated("thin");

    expect(patient.readings).toHaveLength(4);
    expect(result.overallState).toBe("Not enough data");
    expect(result.bmiContext.bmi).toBeNull();
    expect(result.bmiContext.alertEligible).toBe(false);
  });
});
