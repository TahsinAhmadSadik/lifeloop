import type { PhotoImportDraftRow, PhotoImportResult } from "./photo-import";

/** Fixed synthetic fixture for filming; it is never represented as a live Gemini response. */
export const recordedPhotoImportResult: PhotoImportResult = {
  imageQuality: "fair",
  notes: "Synthetic demo diary page. One field is intentionally low-confidence for the review demonstration.",
  rows: [{
    date: "2026-10-18",
    time: "08:15",
    systolic: 132,
    diastolic: 84,
    pulse: 78,
    glucose: 7.2,
    glucoseUnit: "mmol/L",
    confidence: {
      date: 0.96,
      time: 0.91,
      systolic: 0.94,
      diastolic: 0.93,
      pulse: 0.73,
      glucose: 0.78,
      glucoseUnit: 0.68,
    },
    rawText: "১৮ অক্টোবর, সকাল ৮:১৫ · প্রেসার ১৩২/৮৪ · পালস ৭৮ · শর্করা ৭.২ mmol/L",
  }],
};

export function createDraftRow(
  row: PhotoImportResult["rows"][number],
  id: string,
): PhotoImportDraftRow {
  return { ...row, id, editedFields: [] };
}
