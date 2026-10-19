import { ENGINE_CONFIG } from "./config";
import type { CoreSignal, EngineReading, EngineSignal, EngineUnit, TrustPenalty, TrustResult } from "./types";

const expectedUnit: Record<EngineSignal, EngineUnit> = {
  systolic: "mmHg",
  diastolic: "mmHg",
  glucose: "mg/dL",
  height: "cm",
  weight: "kg",
};

export function validateEngineReading(reading: EngineReading): void {
  if (!reading.id || !reading.patientId) throw new Error("Reading id and patient id are required.");
  if (!Number.isFinite(reading.observedAtMs)) throw new Error("Reading timestamp must be finite.");
  if (!Number.isFinite(reading.value) || reading.value <= 0) throw new Error("Reading value must be finite and positive.");
  if (reading.unit !== expectedUnit[reading.signal]) throw new Error(`Unit ${reading.unit} does not match signal ${reading.signal}.`);
  if (reading.ocrConfidence !== undefined && (!Number.isFinite(reading.ocrConfidence) || reading.ocrConfidence < 0 || reading.ocrConfidence > 1)) {
    throw new Error("OCR confidence must be between 0 and 1.");
  }
}

function hasTerminalDigitPreference(reading: EngineReading, recentReadings: readonly EngineReading[]): boolean {
  const policy = ENGINE_CONFIG.trust.terminalDigit;
  if (!policy.eligibleSignals.includes(reading.signal as CoreSignal)) return false;
  const startMs = reading.observedAtMs - policy.lookbackDays * ENGINE_CONFIG.time.dayMs;
  const priorManual = recentReadings.filter((item) => item.patientId === reading.patientId
    && item.signal === reading.signal
    && item.source === "patient-entered"
    && item.observedAtMs >= startMs
    && item.observedAtMs < reading.observedAtMs);
  if (priorManual.length < policy.minimumReadings) return false;
  const preferenceShare = priorManual.filter((item) => [0, 5].includes(Math.abs(Math.round(item.value)) % 10)).length / priorManual.length;
  const currentDigit = Math.abs(Math.round(reading.value)) % 10;
  return preferenceShare >= policy.heavyPreferenceShare && (currentDigit === 0 || currentDigit === 5);
}

function implausibleJump(reading: EngineReading, previous?: EngineReading): boolean {
  if (!previous || previous.patientId !== reading.patientId || previous.signal !== reading.signal) return false;
  const elapsedMs = reading.observedAtMs - previous.observedAtMs;
  if (elapsedMs < 0 || elapsedMs > ENGINE_CONFIG.trust.jumpWindowMs) return false;
  if (reading.signal === "systolic") return Math.abs(reading.value - previous.value) > ENGINE_CONFIG.trust.maximumJump.systolic;
  if (reading.signal === "glucose") return Math.abs(reading.value - previous.value) > ENGINE_CONFIG.trust.maximumJump.glucose;
  return false;
}

export function trustScore(
  reading: EngineReading,
  context: { previousReading?: EngineReading; recentReadings?: readonly EngineReading[] } = {},
): TrustResult {
  validateEngineReading(reading);
  const breakdown: TrustPenalty[] = [];
  let score = 1;
  const apply = (key: string, factor: number, reason: string, applies: boolean) => {
    breakdown.push({ key, factor: applies ? factor : 1, applied: applies, reason });
    if (applies) score *= factor;
  };

  const isBp = reading.signal === "systolic" || reading.signal === "diastolic";
  apply("missing-bp-repeat", ENGINE_CONFIG.trust.penalties.noRepeatBpWithinFiveMinutes,
    `No BP repeat within ${ENGINE_CONFIG.trust.repeatWindowMs / 60_000} minutes was recorded.`,
    isBp && reading.repeatWithinFiveMinutes === false);
  apply("terminal-digit-preference", ENGINE_CONFIG.trust.penalties.terminalDigitPreference,
    "Recent manual readings show a preference for terminal digits 0 or 5.",
    reading.source === "patient-entered" && hasTerminalDigitPreference(reading, context.recentReadings ?? []));
  apply("implausible-jump", ENGINE_CONFIG.trust.penalties.implausibleJump,
    "This differs sharply from the previous same-signal reading within one hour.",
    implausibleJump(reading, context.previousReading));
  apply("protocol-unconfirmed", ENGINE_CONFIG.trust.penalties.protocolUnconfirmed,
    "The measurement protocol was not confirmed.", !reading.protocolConfirmed);
  apply("patient-entered", ENGINE_CONFIG.trust.penalties.patientEntered,
    "This value was entered by the patient rather than imported from a device.", reading.source === "patient-entered");
  apply("edited-low-confidence-photo", ENGINE_CONFIG.trust.penalties.editedLowConfidencePhoto,
    "A low-confidence OCR field was edited; keep its original extraction linked.",
    reading.source === "photo-import (confirmed)" && reading.ocrEdited === true && (reading.ocrConfidence ?? 1) < ENGINE_CONFIG.trust.lowOcrConfidence);

  const floorApplied = score < ENGINE_CONFIG.trust.floor;
  return { score: Math.max(ENGINE_CONFIG.trust.floor, score), floorApplied, breakdown };
}
