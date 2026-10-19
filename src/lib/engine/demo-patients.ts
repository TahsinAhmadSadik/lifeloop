import { ENGINE_CONFIG } from "./config";
import type { EngineReading } from "./types";

const { dayMs, hourMs } = ENGINE_CONFIG.time;
const SYNTHETIC_START_MS = Date.UTC(2026, 8, 1);
const EXPECTED_DAYS = 28;
const EXPECTED_CORE_READINGS = EXPECTED_DAYS * 5;
const MISSING_CORE_READINGS = Math.round(EXPECTED_CORE_READINGS * 0.15);

export type EngineDemoPatientId = "rahim" | "stable" | "thin";

export type EngineDemoPatient = {
  readonly id: EngineDemoPatientId;
  readonly name: string;
  readonly description: string;
  readonly dataLabel: "Synthetic demo data";
  readonly readings: readonly EngineReading[];
  readonly evaluatedAtMs: number;
  readonly expectedCoreReadings: number;
  readonly missingCoreReadings: number;
  /** Two measurement sessions; systolic and diastolic fields are both low-trust. */
  readonly rushedSessionIds: readonly string[];
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gaussian(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function makeReading(
  patientId: EngineDemoPatientId,
  signal: EngineReading["signal"],
  value: number,
  observedAtMs: number,
  suffix: string,
  rushed = false,
  source?: EngineReading["source"],
): EngineReading {
  const unit: EngineReading["unit"] = signal === "glucose" ? "mg/dL"
    : signal === "height" ? "cm"
      : signal === "weight" ? "kg" : "mmHg";
  return {
    id: `${patientId}-${suffix}`,
    patientId,
    observedAtMs,
    signal,
    value,
    unit,
    source: source ?? (rushed ? "patient-entered" : "device-import"),
    protocolConfirmed: !rushed,
    ...(rushed ? { repeatWithinFiveMinutes: false } : {}),
  };
}

function buildFullTimeline(
  patientId: "rahim" | "stable",
  seed: number,
  hasGradualRise: boolean,
): EngineDemoPatient {
  const random = seededRandom(seed);
  const rushedSlots = new Map<string, string>();
  const rushedSessionIds = ["day-18-morning", "day-24-evening"];
  rushedSlots.set("17:morning:systolic", rushedSessionIds[0]);
  rushedSlots.set("17:morning:diastolic", rushedSessionIds[0]);
  rushedSlots.set("23:evening:systolic", rushedSessionIds[1]);
  rushedSlots.set("23:evening:diastolic", rushedSessionIds[1]);

  const allSlots: { dayIndex: number; session: "morning" | "evening" | "glucose"; signal: "systolic" | "diastolic" | "glucose" }[] = [];
  for (let dayIndex = 0; dayIndex < EXPECTED_DAYS; dayIndex += 1) {
    allSlots.push(
      { dayIndex, session: "morning", signal: "systolic" },
      { dayIndex, session: "morning", signal: "diastolic" },
      { dayIndex, session: "evening", signal: "systolic" },
      { dayIndex, session: "evening", signal: "diastolic" },
      { dayIndex, session: "glucose", signal: "glucose" },
    );
  }

  // Keep exactly 15% of core slots missing, while preserving both rushed examples.
  const rushedSlotKeys = new Set(rushedSlots.keys());
  const candidates = allSlots.filter(({ dayIndex, session, signal }) =>
    !rushedSlotKeys.has(`${dayIndex}:${session}:${signal}`));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  const missingKeys = new Set(candidates.slice(0, MISSING_CORE_READINGS).map(({ dayIndex, session, signal }) =>
    `${dayIndex}:${session}:${signal}`));

  const readings: EngineReading[] = [];
  for (let dayIndex = 0; dayIndex < EXPECTED_DAYS; dayIndex += 1) {
    const dayStart = SYNTHETIC_START_MS + dayIndex * dayMs;
    const change = hasGradualRise && dayIndex >= 14
      ? 8 * ((dayIndex - 13) / 14)
      : 0;
    const sessions = [
      { name: "morning" as const, hour: 7 },
      { name: "evening" as const, hour: 19 },
    ];

    for (const session of sessions) {
      for (const signal of ["systolic", "diastolic"] as const) {
        const slotKey = `${dayIndex}:${session.name}:${signal}`;
        if (missingKeys.has(slotKey)) continue;

        const rushedSession = rushedSlots.get(slotKey);
        const noise = gaussian(random);
        const base = signal === "systolic" ? 126 + change : 79 + change * 0.25;
        const spread = signal === "systolic" ? 5 : 4;
        const rushedValue = signal === "systolic" ? 139 : 93;
        const rawValue = rushedSession ? rushedValue : base + noise * spread;
        const ceiling = signal === "systolic" ? ENGINE_CONFIG.demoFixedLimits.systolic - 3 : ENGINE_CONFIG.demoFixedLimits.diastolic - 3;
        const value = Math.round(Math.min(ceiling, Math.max(signal === "systolic" ? 105 : 60, rawValue)));
        const timestamp = dayStart + session.hour * hourMs;
        readings.push(makeReading(patientId, signal, value, timestamp, `d${dayIndex + 1}-${session.name}-${signal}`, Boolean(rushedSession)));
      }
    }

    const glucoseKey = `${dayIndex}:glucose:glucose`;
    if (!missingKeys.has(glucoseKey)) {
      const value = Math.round(Math.min(ENGINE_CONFIG.demoFixedLimits.glucoseMgDl - 1, Math.max(40, 122 + gaussian(random) * 11)));
      readings.push(makeReading(patientId, "glucose", value, dayStart + 8 * hourMs, `d${dayIndex + 1}-glucose`));
    }
  }

  // These synthetic adult profile measurements are contextual only and do not enter alert logic.
  if (patientId === "rahim") {
    readings.push(makeReading(patientId, "height", 170, SYNTHETIC_START_MS, "profile-height", false, "patient-entered"));
    readings.push(makeReading(patientId, "weight", 76, SYNTHETIC_START_MS + hourMs, "profile-weight", false, "patient-entered"));
  } else {
    readings.push(makeReading(patientId, "height", 166, SYNTHETIC_START_MS, "profile-height", false, "patient-entered"));
    readings.push(makeReading(patientId, "weight", 69, SYNTHETIC_START_MS + hourMs, "profile-weight", false, "patient-entered"));
  }

  return {
    id: patientId,
    name: patientId === "rahim" ? "Rahim" : "Stable",
    description: patientId === "rahim"
      ? "২৮ দিনের নমুনা; ১৫তম দিন থেকে সিস্টোলিক মান ধীরে বাড়ে, কিন্তু কোনো একক মান ডেমো সীমা অতিক্রম করে না।"
      : "২৮ দিনের নমুনা; নির্দিষ্ট কোনো পরিবর্তন যোগ করা হয়নি।",
    dataLabel: "Synthetic demo data",
    readings: readings.sort((first, second) => first.observedAtMs - second.observedAtMs),
    evaluatedAtMs: SYNTHETIC_START_MS + EXPECTED_DAYS * dayMs - 1,
    expectedCoreReadings: EXPECTED_CORE_READINGS,
    missingCoreReadings: MISSING_CORE_READINGS,
    rushedSessionIds,
  };
}

function buildThinTimeline(): EngineDemoPatient {
  const readings = [
    makeReading("thin", "systolic", 127, SYNTHETIC_START_MS + 22 * dayMs, "d23-systolic"),
    makeReading("thin", "diastolic", 80, SYNTHETIC_START_MS + 23 * dayMs, "d24-diastolic"),
    makeReading("thin", "glucose", 124, SYNTHETIC_START_MS + 24 * dayMs, "d25-glucose"),
    makeReading("thin", "systolic", 129, SYNTHETIC_START_MS + 26 * dayMs, "d27-systolic"),
  ];
  return {
    id: "thin",
    name: "Thin",
    description: "সাম্প্রতিক সময়ে মাত্র ৪টি নমুনা রিডিং; তুলনার জন্য পর্যাপ্ত তথ্য নেই।",
    dataLabel: "Synthetic demo data",
    readings,
    evaluatedAtMs: SYNTHETIC_START_MS + EXPECTED_DAYS * dayMs - 1,
    expectedCoreReadings: 4,
    missingCoreReadings: 0,
    rushedSessionIds: [],
  };
}

export function createDemoEnginePatients(): readonly EngineDemoPatient[] {
  return [
    buildFullTimeline("rahim", 730_241, true),
    buildFullTimeline("stable", 730_242, false),
    buildThinTimeline(),
  ];
}

export const DEMO_ENGINE_PATIENTS = createDemoEnginePatients();

export function getDemoEnginePatient(id: EngineDemoPatientId): EngineDemoPatient {
  const patient = DEMO_ENGINE_PATIENTS.find((item) => item.id === id);
  if (!patient) throw new Error(`Unknown synthetic demo patient: ${id}`);
  return patient;
}
