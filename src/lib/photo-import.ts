import { ENGINE_CONFIG } from "./engine/config";
import type { EngineReading } from "./engine/types";
import { glucoseToMgdl, type GlucoseUnit } from "./health";

export type PhotoImportField = "date" | "time" | "systolic" | "diastolic" | "pulse" | "glucose" | "glucoseUnit";
export type PhotoImportConfidence = Record<PhotoImportField, number>;

export type PhotoImportDraftRow = {
  id: string;
  date: string | null;
  time: string | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  glucose: number | null;
  glucoseUnit: GlucoseUnit | null;
  confidence: PhotoImportConfidence;
  rawText: string;
  editedFields: PhotoImportField[];
  previousConfirmedId?: string;
};

export type ConfirmedPhotoImport = Omit<PhotoImportDraftRow, "previousConfirmedId" | "date" | "time"> & {
  date: string;
  time: string;
  source: "photo-import (confirmed)";
  confirmedAt: number;
  originalReadingId?: string;
};

export type PhotoImportResult = {
  rows: Array<Omit<PhotoImportDraftRow, "id" | "editedFields" | "previousConfirmedId">>;
  imageQuality: "good" | "fair" | "poor";
  notes: string | null;
};

export const PHOTO_IMPORT_TIMELINE_KEY = "lifeloop.demo.photo-import-timeline.v1";

const fieldKeys: readonly PhotoImportField[] = ["date", "time", "systolic", "diastolic", "pulse", "glucose", "glucoseUnit"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableFiniteNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${field} in model response.`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Invalid ${field} in model response.`);
  return value.trim() || null;
}

/** Runtime-check the structured output; Gemini's schema is not treated as validation. */
export function parsePhotoImportResult(value: unknown): PhotoImportResult {
  if (!isRecord(value) || !Array.isArray(value.rows) || value.rows.length === 0 || value.rows.length > ENGINE_CONFIG.photoImport.maximumRows) {
    throw new Error("The model response did not match the expected row format.");
  }
  if (value.image_quality !== "good" && value.image_quality !== "fair" && value.image_quality !== "poor") {
    throw new Error("The model response did not include a valid image-quality value.");
  }
  const notes = value.notes === null ? null : nullableString(value.notes, "notes");

  const rows = value.rows.map((item) => {
    if (!isRecord(item) || !isRecord(item.confidence)) throw new Error("A model row is missing required fields.");
    const rawText = item.raw_text;
    if (typeof rawText !== "string" || rawText.length > ENGINE_CONFIG.photoImport.maximumRawTextLength) {
      throw new Error("A model row has invalid source text.");
    }
    const glucoseUnit: GlucoseUnit | null = item.glucose_unit === null || item.glucose_unit === ""
      ? null
      : item.glucose_unit === "mg/dL" || item.glucose_unit === "mmol/L"
        ? item.glucose_unit
        : null;
    if (item.glucose_unit !== null && item.glucose_unit !== "" && glucoseUnit === null) {
      throw new Error("A model row contains an unsupported glucose unit.");
    }

    const confidence = {} as PhotoImportConfidence;
    const apiFieldNames: Record<PhotoImportField, string> = {
      date: "date",
      time: "time",
      systolic: "systolic",
      diastolic: "diastolic",
      pulse: "pulse",
      glucose: "glucose",
      glucoseUnit: "glucose_unit",
    };
    for (const field of fieldKeys) {
      const score = item.confidence[apiFieldNames[field]];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
        throw new Error(`A model row contains invalid confidence for ${apiFieldNames[field]}.`);
      }
      confidence[field] = score;
    }

    return {
      date: nullableString(item.date, "date"),
      time: nullableString(item.time, "time"),
      systolic: nullableFiniteNumber(item.systolic, "systolic"),
      diastolic: nullableFiniteNumber(item.diastolic, "diastolic"),
      pulse: nullableFiniteNumber(item.pulse, "pulse"),
      glucose: nullableFiniteNumber(item.glucose, "glucose"),
      glucoseUnit,
      confidence,
      rawText,
    };
  });
  return { rows, imageQuality: value.image_quality, notes };
}

export function photoImportIssues(row: PhotoImportDraftRow, today = new Date()): string[] {
  const issues: string[] = [];
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    issues.push("তারিখ স্পষ্ট নয়—যাচাই করে লিখুন।");
  } else {
    const [year, month, day] = row.date.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) issues.push("তারিখটি সঠিক নয়।");
    else if (parsedDate > todayDate) issues.push("ভবিষ্যতের তারিখ নিশ্চিত করা যাবে না।");
  }
  if (!row.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) issues.push("সময়টি স্পষ্ট করুন; অনুমান করে সময় বসাবেন না।");

  const hasBp = row.systolic !== null || row.diastolic !== null;
  if (hasBp && (row.systolic === null || row.diastolic === null)) issues.push("রক্তচাপের দুই মানই মিলিয়ে দিন, নইলে দুটিই খালি রাখুন।");
  if (row.systolic !== null && (row.systolic < ENGINE_CONFIG.photoImport.systolicBounds.minimum || row.systolic > ENGINE_CONFIG.photoImport.systolicBounds.maximum)) {
    issues.push("সিস্টোলিক মানটি ডেমো যাচাই-সীমার বাইরে—মূল ছবির সঙ্গে মিলিয়ে দেখুন।");
  }
  if (row.diastolic !== null && (row.diastolic < ENGINE_CONFIG.photoImport.diastolicBounds.minimum || row.diastolic > ENGINE_CONFIG.photoImport.diastolicBounds.maximum)) {
    issues.push("ডায়াস্টোলিক মানটি ডেমো যাচাই-সীমার বাইরে—মূল ছবির সঙ্গে মিলিয়ে দেখুন।");
  }
  if (row.systolic !== null && row.diastolic !== null && row.systolic <= row.diastolic) issues.push("সিস্টোলিক ও ডায়াস্টোলিক মান আবার মিলিয়ে দেখুন।");
  if (row.pulse !== null && (row.pulse < ENGINE_CONFIG.photoImport.pulseBounds.minimum || row.pulse > ENGINE_CONFIG.photoImport.pulseBounds.maximum)) {
    issues.push("পালসের মানটি ডেমো যাচাই-সীমার বাইরে—মূল ছবির সঙ্গে মিলিয়ে দেখুন।");
  }
  if (row.glucose !== null && row.glucose <= 0) issues.push("শর্করার মানটি মূল ছবির সঙ্গে মিলিয়ে দেখুন।");
  if (row.glucose !== null && row.glucoseUnit === null) issues.push("শর্করার একক স্পষ্ট নয়—একক না পাওয়া পর্যন্ত সংরক্ষণ করবেন না।");
  if (row.systolic === null && row.diastolic === null && row.pulse === null && row.glucose === null) issues.push("সংরক্ষণের জন্য কোনো মাপ পাওয়া যায়নি।");
  return issues;
}

export function lowConfidenceFields(row: PhotoImportDraftRow): PhotoImportField[] {
  return fieldKeys.filter((field) => row.confidence[field] < ENGINE_CONFIG.photoImport.lowConfidenceReviewThreshold);
}

export function appendConfirmedPhotoRows(
  existing: readonly ConfirmedPhotoImport[],
  incoming: readonly ConfirmedPhotoImport[],
): ConfirmedPhotoImport[] {
  return [...existing, ...incoming];
}

export function readPhotoImportTimeline(storage: Storage = sessionStorage): ConfirmedPhotoImport[] {
  try {
    const raw = storage.getItem(PHOTO_IMPORT_TIMELINE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isConfirmedPhotoImport) : [];
  } catch {
    return [];
  }
}

export function appendPhotoImportTimeline(
  incoming: readonly ConfirmedPhotoImport[],
  storage: Storage = sessionStorage,
): ConfirmedPhotoImport[] {
  const updated = appendConfirmedPhotoRows(readPhotoImportTimeline(storage), incoming);
  storage.setItem(PHOTO_IMPORT_TIMELINE_KEY, JSON.stringify(updated));
  return updated;
}

/** Converts only explicitly confirmed records; pulse remains contextual and is not an engine alert signal. */
export function photoImportToEngineReadings(record: ConfirmedPhotoImport, patientId = "photo-import-demo"): EngineReading[] {
  const [year, month, day] = record.date.split("-").map(Number);
  const [hour, minute] = record.time.split(":").map(Number);
  const observedAtMs = new Date(year, month - 1, day, hour, minute).getTime();
  if (!Number.isFinite(observedAtMs)) throw new Error("Confirmed photo record has invalid date/time.");

  const output: EngineReading[] = [];
  const add = (
    signal: "systolic" | "diastolic" | "glucose",
    value: number | null,
    confidenceField: PhotoImportField,
    unit: EngineReading["unit"],
  ) => {
    if (value === null) return;
    if (signal === "glucose" && record.glucoseUnit === null) throw new Error("A confirmed glucose reading must have an explicit unit.");
    const canonicalValue = signal === "glucose" ? glucoseToMgdl(value, record.glucoseUnit!) : value;
    const originalReadingId = record.originalReadingId ? `${record.originalReadingId}-${signal}` : undefined;
    output.push({
      id: `${record.id}-${signal}`,
      patientId,
      observedAtMs,
      signal,
      value: canonicalValue,
      unit: signal === "glucose" ? "mg/dL" : unit,
      source: "photo-import (confirmed)",
      protocolConfirmed: false,
      ocrConfidence: record.confidence[confidenceField],
      ocrEdited: record.editedFields.includes(confidenceField),
      ...(originalReadingId ? { originalReadingId } : {}),
    });
  };

  add("systolic", record.systolic, "systolic", "mmHg");
  add("diastolic", record.diastolic, "diastolic", "mmHg");
  add("glucose", record.glucose, "glucose", "mg/dL");
  return output;
}

function isConfirmedPhotoImport(value: unknown): value is ConfirmedPhotoImport {
  return isRecord(value) && value.source === "photo-import (confirmed)"
    && typeof value.id === "string" && typeof value.date === "string" && typeof value.time === "string";
}

export function makePhotoImportId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
