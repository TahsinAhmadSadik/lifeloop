export { ENGINE_CONFIG } from "./config";
export { computeBaseline, median, medianAbsoluteDeviation, updateBaseline } from "./baseline";
export { deriveBmiContext } from "./body-metrics";
export { createDemoEnginePatients, DEMO_ENGINE_PATIENTS, getDemoEnginePatient } from "./demo-patients";
export type { EngineDemoPatient, EngineDemoPatientId } from "./demo-patients";
export { calibrateAlertThreshold, compareFixedThreshold, runCusum } from "./cusum";
export { evaluatePatient } from "./evaluate";
export { overallState, signalState } from "./state";
export { trustScore, validateEngineReading } from "./trust";
export type {
  AlertCalibrationResult,
  BaselineWindow,
  BmiContext,
  BodySignal,
  CoreSignal,
  CusumResult,
  EngineReading,
  EngineSignal,
  EngineSource,
  EngineStateName,
  EngineUnit,
  FixedThresholdResult,
  NullPatientTrace,
  PatientEngineResult,
  ScoredReading,
  SignalBaseline,
  SignalState,
  TrustPenalty,
  TrustResult,
} from "./types";
