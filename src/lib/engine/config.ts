/** Engineering hypotheses for synthetic demo behavior only, not clinical standards. */
export const ENGINE_CONFIG = {
  time: {
    minuteMs: 60 * 1000,
    hourMs: 60 * 60 * 1000,
    dayMs: 24 * 60 * 60 * 1000,
  },
  trust: {
    floor: 0.2,
    minimumForBaseline: 0.5,
    penalties: {
      noRepeatBpWithinFiveMinutes: 0.85,
      terminalDigitPreference: 0.85,
      implausibleJump: 0.6,
      protocolUnconfirmed: 0.8,
      patientEntered: 0.9,
      editedLowConfidencePhoto: 0.9,
    },
    repeatWindowMs: 5 * 60 * 1000,
    jumpWindowMs: 60 * 60 * 1000,
    maximumJump: { systolic: 40, glucose: 60 },
    terminalDigit: {
      lookbackDays: 30,
      minimumReadings: 10,
      heavyPreferenceShare: 0.7,
      eligibleSignals: ["systolic", "diastolic", "glucose"],
    },
    lowOcrConfidence: 0.8,
  },
  baseline: {
    initialReferenceDays: 14,
    recentWindowDays: 7,
    stateWindowDays: 14,
    minimumUsableForBaseline: 6,
    notEnoughBelow: 6,
    learningMaximum: 11,
    minimumUsableForReady: 12,
    minimumTrust: 0.5,
    madScale: 1.4826,
    madFloor: { systolic: 3, diastolic: 2, glucose: 5 },
    expectedReadingsPerDay: { systolic: 2, diastolic: 2, glucose: 1 },
  },
  cusum: {
    k: 0.5,
    initialH: 4,
    candidateH: [2, 3, 4, 5, 6, 8, 10],
    uncertaintyWidening: 1.5,
  },
  // Illustrative single-reading limits for the synthetic comparator only.
  demoFixedLimits: { systolic: 145, diastolic: 100, glucoseMgDl: 250 },
  alertBudget: {
    targetFalseAlertsPerPatientMonth: 1,
    episodeResetBelowFractionOfH: 0.5,
    daysPerMonth: 30,
  },
  bodyMetrics: {
    bmiStandaloneAlertEnabled: false,
  },
  // Import sanity limits are for synthetic-demo review, not medical thresholds.
  photoImport: {
    maximumImageBytes: 8 * 1024 * 1024,
    maximumRows: 12,
    maximumRawTextLength: 1000,
    lowConfidenceReviewThreshold: 0.8,
    systolicBounds: { minimum: 70, maximum: 260 },
    diastolicBounds: { minimum: 40, maximum: 150 },
    pulseBounds: { minimum: 30, maximum: 220 },
  },
} as const;
