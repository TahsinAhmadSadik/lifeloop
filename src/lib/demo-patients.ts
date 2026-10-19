import { mmolToMgdl } from "@/lib/health";

export type DemoReading = {
  id: number;
  date: string;
  glucoseMgDl: number | null;
  systolic: number | null;
  diastolic: number | null;
  time: string;
  source: "sample" | "manual-demo" | "ai-draft-demo";
};

export type DemoPatient = {
  id: string;
  name: string;
  initials: string;
  conditions: string[];
  lastVisit: string;
  readings: DemoReading[];
};

export type DemoSharePayload = {
  version: 1;
  token: string;
  patientId: string;
  period: "week" | "all";
  glucose: boolean;
  pressure: boolean;
  createdAt: number;
  expiresAt: number;
  records: DemoReading[];
};

export const demoShareStorageKey = "lifeloop:doctor-demo-share:v1";

export const rafiDemoReadings: DemoReading[] = [
  { id: 1, date: "১২ অক্টো", glucoseMgDl: mmolToMgdl(7.1), systolic: 132, diastolic: 84, time: "সকাল ৮:১২", source: "sample" },
  { id: 2, date: "১৩ অক্টো", glucoseMgDl: mmolToMgdl(7.4), systolic: 134, diastolic: 86, time: "সকাল ৮:০৪", source: "sample" },
  { id: 3, date: "১৪ অক্টো", glucoseMgDl: mmolToMgdl(7.2), systolic: 131, diastolic: 83, time: "সকাল ৮:২১", source: "sample" },
  { id: 4, date: "১৫ অক্টো", glucoseMgDl: mmolToMgdl(7.8), systolic: 137, diastolic: 88, time: "সকাল ৮:০৯", source: "sample" },
  { id: 5, date: "১৬ অক্টো", glucoseMgDl: mmolToMgdl(7.6), systolic: 135, diastolic: 87, time: "সকাল ৮:১৬", source: "sample" },
  { id: 6, date: "১৭ অক্টো", glucoseMgDl: mmolToMgdl(7.9), systolic: 139, diastolic: 89, time: "সকাল ৮:১১", source: "sample" },
  { id: 7, date: "১৮ অক্টো", glucoseMgDl: mmolToMgdl(7.7), systolic: 136, diastolic: 86, time: "সকাল ৮:০৭", source: "sample" },
];

export const demoPatients: DemoPatient[] = [
  {
    id: "rafi-demo",
    name: "রাফি আহমেদ",
    initials: "রা",
    conditions: ["টাইপ ২ ডায়াবেটিস", "উচ্চ রক্তচাপ"],
    lastVisit: "১৮ অক্টো",
    readings: rafiDemoReadings,
  },
  {
    id: "samira-demo",
    name: "সামিরা রহমান",
    initials: "সা",
    conditions: ["টাইপ ২ ডায়াবেটিস", "উচ্চ রক্তচাপ"],
    lastVisit: "১৭ অক্টো",
    readings: [
      { id: 21, date: "১২ অক্টো", glucoseMgDl: mmolToMgdl(6.8), systolic: 128, diastolic: 82, time: "সকাল ৭:৫০", source: "sample" },
      { id: 22, date: "১৩ অক্টো", glucoseMgDl: mmolToMgdl(6.9), systolic: 129, diastolic: 82, time: "সকাল ৭:৫৪", source: "sample" },
      { id: 23, date: "১৪ অক্টো", glucoseMgDl: mmolToMgdl(6.7), systolic: 127, diastolic: 81, time: "সকাল ৭:৪৮", source: "sample" },
      { id: 24, date: "১৫ অক্টো", glucoseMgDl: mmolToMgdl(6.9), systolic: 128, diastolic: 82, time: "সকাল ৭:৫৩", source: "sample" },
      { id: 25, date: "১৬ অক্টো", glucoseMgDl: mmolToMgdl(6.8), systolic: 129, diastolic: 83, time: "সকাল ৭:৫১", source: "sample" },
      { id: 26, date: "১৭ অক্টো", glucoseMgDl: mmolToMgdl(6.9), systolic: 128, diastolic: 82, time: "সকাল ৭:৫৫", source: "sample" },
    ],
  },
  {
    id: "hasan-demo",
    name: "হাসান মাহমুদ",
    initials: "হা",
    conditions: ["টাইপ ২ ডায়াবেটিস", "উচ্চ রক্তচাপ"],
    lastVisit: "১৫ অক্টো",
    readings: [
      { id: 31, date: "১০ অক্টো", glucoseMgDl: mmolToMgdl(7.2), systolic: 133, diastolic: 85, time: "সকাল ৮:২০", source: "sample" },
      { id: 32, date: "১১ অক্টো", glucoseMgDl: mmolToMgdl(7.3), systolic: 134, diastolic: 85, time: "সকাল ৮:১৭", source: "sample" },
      { id: 33, date: "১২ অক্টো", glucoseMgDl: mmolToMgdl(7.2), systolic: 132, diastolic: 84, time: "সকাল ৮:১৯", source: "sample" },
      { id: 34, date: "১৩ অক্টো", glucoseMgDl: mmolToMgdl(7.5), systolic: 137, diastolic: 88, time: "সকাল ৮:২২", source: "sample" },
      { id: 35, date: "১৪ অক্টো", glucoseMgDl: mmolToMgdl(7.6), systolic: 138, diastolic: 89, time: "সকাল ৮:১৮", source: "sample" },
      { id: 36, date: "১৫ অক্টো", glucoseMgDl: mmolToMgdl(7.4), systolic: 136, diastolic: 87, time: "সকাল ৮:২৩", source: "sample" },
    ],
  },
];

export function isDemoSharePayload(value: unknown): value is DemoSharePayload {
  if (typeof value !== "object" || value === null) return false;
  const share = value as Partial<DemoSharePayload>;
  return share.version === 1
    && typeof share.token === "string" && share.token.startsWith("DEMO-")
    && demoPatients.some((patient) => patient.id === share.patientId)
    && (share.period === "week" || share.period === "all")
    && typeof share.glucose === "boolean"
    && typeof share.pressure === "boolean"
    && typeof share.createdAt === "number"
    && typeof share.expiresAt === "number"
    && Array.isArray(share.records)
    && share.records.every((record) => typeof record.date === "string"
      && typeof record.time === "string"
      && (record.glucoseMgDl === null || typeof record.glucoseMgDl === "number")
      && (record.systolic === null || typeof record.systolic === "number")
      && (record.diastolic === null || typeof record.diastolic === "number"));
}
