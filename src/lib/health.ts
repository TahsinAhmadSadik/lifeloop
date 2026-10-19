export type GlucoseUnit = "mg/dL" | "mmol/L";

const MGDL_PER_MMOL = 18.016;
const KG_PER_POUND = 0.45359237;
const CM_PER_INCH = 2.54;

export function mgdlToMmol(value: number): number {
  return value / MGDL_PER_MMOL;
}

export function mmolToMgdl(value: number): number {
  return value * MGDL_PER_MMOL;
}

export function glucoseToMgdl(value: number, unit: GlucoseUnit): number {
  return unit === "mmol/L" ? mmolToMgdl(value) : value;
}

export function glucoseFromMgdl(value: number, unit: GlucoseUnit): number {
  return unit === "mmol/L" ? mgdlToMmol(value) : value;
}

export function poundsToKg(value: number): number {
  return value * KG_PER_POUND;
}

export function inchesToCm(value: number): number {
  return value * CM_PER_INCH;
}

/** BMI is a derived adult screening measure; it is not a diagnosis or alert threshold. */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) return null;
  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);
  return Number.isFinite(bmi) ? bmi : null;
}

export function parseLocalizedNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const localized = value
    .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/٫/g, ".")
    .trim();
  const normalized = localized
    .replace(/([0-9]),([0-9]{1,2})$/, "$1.$2")
    .replace(/[٬,]/g, "");

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
