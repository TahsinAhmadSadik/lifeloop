export type CoreSignal = "systolic" | "diastolic" | "glucose";
export type BodySignal = "height" | "weight";
export type EngineSignal = CoreSignal | BodySignal;
export type EngineSource = "device-import" | "patient-entered" | "photo-import (confirmed)";
export type EngineUnit = "mmHg" | "mg/dL" | "cm" | "kg";

/** Persisted confirmed readings only. OCR/AI drafts use a separate draft type. */
export type EngineReading = {
  readonly id: string;
  readonly patientId: string;
  readonly observedAtMs: number;
  readonly signal: EngineSignal;
  readonly value: number;
  readonly unit: EngineUnit;
  readonly source: EngineSource;
  readonly protocolConfirmed: boolean;
  /** BP context: whether a repeat was captured in the demo's configured window. */
  readonly repeatWithinFiveMinutes?: boolean;
  readonly ocrConfidence?: number;
  readonly ocrEdited?: boolean;
  /** Corrections append a new reading and keep the original linked and visible. */
  readonly originalReadingId?: string;
};

export type TrustPenalty = {
  readonly key: string;
  readonly factor: number;
  readonly applied: boolean;
  readonly reason: string;
};

export type TrustResult = {
  readonly score: number;
  readonly floorApplied: boolean;
  readonly breakdown: readonly TrustPenalty[];
};

export type ScoredReading = { readonly reading: EngineReading; readonly trust: TrustResult };

export type BaselineWindow = {
  readonly startMs: number;
  /** End is exclusive, so a sample cannot enter adjacent windows twice. */
  readonly endMs: number;
};

export type SignalBaseline = {
  readonly signal: CoreSignal;
  readonly window: BaselineWindow;
  readonly center: number | null;
  readonly mad: number | null;
  readonly spread: number | null;
  readonly usableCount: number;
  readonly frozen: boolean;
};

export type BmiContext = {
  readonly bmi: number | null;
  readonly heightReadingId: string | null;
  readonly weightReadingId: string | null;
  readonly trust: number | null;
  readonly alertEligible: false;
};

export type EngineStateName = "Not enough data" | "Learning your pattern" | "Within your recent pattern" | "Repeated change to review";

export type SignalState = {
  readonly signal: CoreSignal;
  readonly state: EngineStateName;
  readonly reason: string;
  readonly period: BaselineWindow;
  readonly measuresUsed: readonly CoreSignal[];
  readonly usableReadings: number;
  readonly expectedReadings: number;
  readonly coverage: number;
};

export type CusumPoint = {
  readonly readingId: string;
  readonly observedAtMs: number;
  readonly value: number;
  readonly trust: number;
  readonly robustZ: number;
  readonly weightedZ: number;
  readonly score: number;
  readonly uncertaintyLower: number;
  readonly uncertaintyUpper: number;
};

export type CusumResult = {
  readonly signal: CoreSignal;
  readonly h: number;
  readonly active: boolean;
  readonly finalScore: number;
  readonly points: readonly CusumPoint[];
  readonly coverage: number;
  readonly meanTrust: number;
};

export type FixedThresholdResult = {
  readonly readingId: string;
  readonly signal: CoreSignal;
  readonly value: number;
  readonly limit: number;
  readonly exceeded: boolean;
};

export type PatientEngineResult = {
  readonly evaluatedAtMs: number;
  readonly overallState: EngineStateName;
  readonly reason: string;
  readonly signalStates: readonly SignalState[];
  readonly baselines: readonly SignalBaseline[];
  readonly cusum: readonly CusumResult[];
  readonly topContributingSignals: readonly CoreSignal[];
  readonly fixedThresholds: readonly FixedThresholdResult[];
  readonly bmiContext: BmiContext;
  readonly baselineFrozen: boolean;
};

export type NullPatientTrace = { readonly patientId: string; readonly observedDays: number; readonly cusumScores: readonly number[] };

export type AlertCalibrationResult = {
  readonly h: number;
  readonly alerts: number;
  readonly patientMonths: number;
  readonly alertsPerPatientMonth: number;
  readonly targetAlertsPerPatientMonth: number;
  readonly targetMet: boolean;
};
