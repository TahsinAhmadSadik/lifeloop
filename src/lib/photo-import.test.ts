import { describe, expect, it } from "vitest";
import { createDraftRow, recordedPhotoImportResult } from "./photo-import-sample";
import {
  appendConfirmedPhotoRows,
  lowConfidenceFields,
  parsePhotoImportResult,
  photoImportToEngineReadings,
  photoImportIssues,
  type ConfirmedPhotoImport,
} from "./photo-import";

describe("photo import validation", () => {
  it("parses the expected response shape and preserves nulls and per-field confidence", () => {
    const result = parsePhotoImportResult({
      rows: [{
        date: null,
        time: "08:20",
        systolic: 132,
        diastolic: 84,
        pulse: null,
        glucose: 7.1,
        glucose_unit: "mmol/L",
        confidence: { date: 0.1, time: 0.9, systolic: 0.95, diastolic: 0.94, pulse: 0.1, glucose: 0.82, glucose_unit: 0.8 },
        raw_text: "ডেমো লেখা",
      }],
      image_quality: "fair",
      notes: null,
    });

    expect(result.rows[0].date).toBeNull();
    expect(result.rows[0].pulse).toBeNull();
    expect(result.rows[0].glucoseUnit).toBe("mmol/L");
    expect(result.rows[0].confidence.glucoseUnit).toBe(0.8);
  });

  it("rejects malformed fields rather than coercing the model response", () => {
    expect(() => parsePhotoImportResult({ rows: [{ date: "yesterday" }], image_quality: "good", notes: null }))
      .toThrow(/required fields/);
  });

  it("keeps the recorded sample valid and flags low-confidence cells for review", () => {
    const row = createDraftRow(recordedPhotoImportResult.rows[0], "fixture-row");
    expect(photoImportIssues(row, new Date("2026-10-19T00:00:00"))).toEqual([]);
    expect(lowConfidenceFields(row)).toContain("glucoseUnit");
  });

  it("blocks missing dates, unconfirmed units, and implausible input values", () => {
    const row: ReturnType<typeof createDraftRow> = {
      ...createDraftRow(recordedPhotoImportResult.rows[0], "bad-row"),
      date: null,
      glucoseUnit: null,
      systolic: 999,
    };
    const issues = photoImportIssues(row, new Date("2026-10-19T00:00:00"));
    expect(issues.some((issue) => issue.includes("তারিখ"))).toBe(true);
    expect(issues.some((issue) => issue.includes("একক"))).toBe(true);
    expect(issues.some((issue) => issue.includes("সিস্টোলিক"))).toBe(true);
    expect(photoImportIssues({ ...row, date: "2026-02-31", glucoseUnit: "mmol/L", systolic: 132 }, new Date("2026-10-19T00:00:00")))
      .toContain("তারিখটি সঠিক নয়।");
  });

  it("appends corrections without removing the original confirmed record", () => {
    const original = {
      ...createDraftRow(recordedPhotoImportResult.rows[0], "row-original"),
      id: "record-original",
      source: "photo-import (confirmed)" as const,
      confirmedAt: 10,
    } as ConfirmedPhotoImport;
    const correction = { ...original, id: "record-correction", originalReadingId: original.id, glucose: 7.3, confirmedAt: 20 };
    const timeline = appendConfirmedPhotoRows([original], [correction]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual(original);
    expect(timeline[1].originalReadingId).toBe(original.id);
  });

  it("projects confirmed photo values into the deterministic engine without losing provenance", () => {
    const draft = createDraftRow(recordedPhotoImportResult.rows[0], "draft-row");
    const confirmed: ConfirmedPhotoImport = {
      ...draft,
      date: "2026-10-18",
      time: "08:15",
      source: "photo-import (confirmed)",
      confirmedAt: 10,
    };
    const engineReadings = photoImportToEngineReadings(confirmed, "synthetic-person");

    expect(engineReadings).toHaveLength(3);
    expect(engineReadings.map(({ source }) => source)).toEqual(Array(3).fill("photo-import (confirmed)"));
    expect(engineReadings.find(({ signal }) => signal === "glucose")?.value).toBeCloseTo(129.7152);
    expect(engineReadings.every(({ protocolConfirmed }) => !protocolConfirmed)).toBe(true);
  });
});
