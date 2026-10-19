"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  appendPhotoImportTimeline,
  lowConfidenceFields,
  makePhotoImportId,
  photoImportIssues,
  readPhotoImportTimeline,
  type ConfirmedPhotoImport,
  type PhotoImportDraftRow,
  type PhotoImportField,
  type PhotoImportResult,
} from "@/lib/photo-import";
import { parseLocalizedNumber } from "@/lib/health";
import { ENGINE_CONFIG } from "@/lib/engine/config";
import { createDraftRow, recordedPhotoImportResult } from "@/lib/photo-import-sample";
import styles from "./import.module.css";

type ResultMode = "live-gemini" | "recorded-sample";
type FieldName = Exclude<PhotoImportField, "confidence">;

const fieldLabels: Record<PhotoImportField, string> = {
  date: "তারিখ",
  time: "সময়",
  systolic: "সিস্টোলিক",
  diastolic: "ডায়াস্টোলিক",
  pulse: "পালস",
  glucose: "শর্করা",
  glucoseUnit: "শর্করার একক",
};

const inputFields: readonly FieldName[] = ["date", "time", "systolic", "diastolic", "pulse", "glucose", "glucoseUnit"];

function makeDraftRows(result: PhotoImportResult): PhotoImportDraftRow[] {
  return result.rows.map((row) => createDraftRow(row, makePhotoImportId()));
}

function isPhotoImportResult(value: unknown): value is PhotoImportResult {
  if (typeof value !== "object" || value === null || !("rows" in value) || !Array.isArray(value.rows)) return false;
  return "imageQuality" in value && (value.imageQuality === "good" || value.imageQuality === "fair" || value.imageQuality === "poor")
    && "notes" in value && (value.notes === null || typeof value.notes === "string");
}

function displayValue(row: PhotoImportDraftRow, field: FieldName): string {
  const value = row[field];
  return value === null ? "" : String(value);
}

export default function ImportClient() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [usingRecordedImage, setUsingRecordedImage] = useState(false);
  const [syntheticConsent, setSyntheticConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ResultMode | null>(null);
  const [modelName, setModelName] = useState("");
  const [imageQuality, setImageQuality] = useState<PhotoImportResult["imageQuality"] | null>(null);
  const [draftRows, setDraftRows] = useState<PhotoImportDraftRow[]>([]);
  const [confirmedRowIds, setConfirmedRowIds] = useState<string[]>([]);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionTimeline, setSessionTimeline] = useState<ConfirmedPhotoImport[]>([]);

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const rowsWithIssues = useMemo(() => draftRows.map((row) => ({
    row,
    issues: photoImportIssues(row),
    lowConfidence: lowConfidenceFields(row),
  })), [draftRows]);
  const hasBlockingIssues = rowsWithIssues.some(({ issues }) => issues.length > 0);
  const allRowsConfirmed = draftRows.length > 0 && draftRows.every((row) => confirmedRowIds.includes(row.id));

  function resetResult() {
    setMode(null);
    setModelName("");
    setImageQuality(null);
    setDraftRows([]);
    setConfirmedRowIds([]);
    setReviewAcknowledged(false);
    setNotice("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageFile(null);
      setPreviewUrl(null);
      setError("JPEG, PNG অথবা WebP ছবি নির্বাচন করুন।");
      resetResult();
      event.target.value = "";
      return;
    }
    if (file && file.size > ENGINE_CONFIG.photoImport.maximumImageBytes) {
      setImageFile(null);
      setPreviewUrl(null);
      setError("ছবিটি ৮ MB সীমার চেয়ে বড়। ছোট ছবি নির্বাচন করুন।");
      resetResult();
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setUsingRecordedImage(false);
    setSyntheticConsent(false);
    setError("");
    resetResult();
    event.target.value = "";
  }

  async function analyzeWithGemini() {
    if (!imageFile || !syntheticConsent || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("image", imageFile);
      formData.set("syntheticDemoConsent", "yes");
      const response = await fetch("/api/import/vision", { method: "POST", body: formData });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Gemini এখন ফল দিতে পারছে না। নমুনা ফল বা ম্যানুয়াল এন্ট্রি ব্যবহার করুন।";
        throw new Error(message);
      }
      if (typeof payload !== "object" || payload === null || !("mode" in payload) || payload.mode !== "live-gemini"
        || !("result" in payload) || !isPhotoImportResult(payload.result)) {
        throw new Error("AI উত্তর যাচাই করা যায়নি। কিছুই সংরক্ষণ করা হয়নি।");
      }
      const result = payload.result;
      setDraftRows(makeDraftRows(result));
      setImageQuality(result.imageQuality);
      setMode("live-gemini");
      setModelName("model" in payload && typeof payload.model === "string" ? payload.model : "Gemini");
      setReviewAcknowledged(false);
      setConfirmedRowIds([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gemini সেবা পাওয়া যাচ্ছে না। নমুনা ফল ব্যবহার করুন।");
    } finally {
      setLoading(false);
    }
  }

  function loadRecordedSample() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl("/demo-diary.svg");
    setUsingRecordedImage(true);
    setSyntheticConsent(false);
    setDraftRows(makeDraftRows(recordedPhotoImportResult));
    setImageQuality(recordedPhotoImportResult.imageQuality);
    setMode("recorded-sample");
    setModelName("");
    setConfirmedRowIds([]);
    setReviewAcknowledged(false);
    setError("");
    setNotice("");
  }

  function updateRow(rowId: string, field: FieldName, value: string) {
    setDraftRows((rows) => rows.map((row) => {
      if (row.id !== rowId) return row;
      const editedFields = row.editedFields.includes(field) ? row.editedFields : [...row.editedFields, field];
      if (field === "date" || field === "time") return { ...row, [field]: value || null, editedFields };
      if (field === "glucoseUnit") {
        const glucoseUnit = value === "mg/dL" || value === "mmol/L" ? value : null;
        return { ...row, glucoseUnit, editedFields };
      }
      const numeric = parseLocalizedNumber(value);
      return { ...row, [field]: numeric, editedFields };
    }));
    setConfirmedRowIds((current) => current.filter((id) => id !== rowId));
    setReviewAcknowledged(false);
    setNotice("");
  }

  function confirmRows() {
    if (!reviewAcknowledged || hasBlockingIssues || !draftRows.length || allRowsConfirmed) return;
    const unconfirmed = draftRows.filter((row) => !confirmedRowIds.includes(row.id));
    const createdAt = Date.now();
    const records: ConfirmedPhotoImport[] = unconfirmed.map((row) => {
      const originalReadingId = row.previousConfirmedId;
      return {
        id: makePhotoImportId(),
        date: row.date!,
        time: row.time!,
        systolic: row.systolic,
        diastolic: row.diastolic,
        pulse: row.pulse,
        glucose: row.glucose,
        glucoseUnit: row.glucoseUnit,
        confidence: row.confidence,
        rawText: row.rawText,
        editedFields: row.editedFields,
        ...(originalReadingId ? { originalReadingId } : {}),
        source: "photo-import (confirmed)",
        confirmedAt: createdAt,
      };
    });
    const savedByDraftId = new Map(unconfirmed.map((row, index) => [row.id, records[index]]));
    try {
      const savedTimeline = appendPhotoImportTimeline(records);
      setSessionTimeline(savedTimeline);
      setDraftRows((current) => current.map((row) => {
        const saved = savedByDraftId.get(row.id);
        return saved ? { ...row, previousConfirmedId: saved.id, editedFields: [] } : row;
      }));
      setConfirmedRowIds((current) => [...current, ...unconfirmed.map((row) => row.id)]);
      setNotice(`${records.length}টি রেকর্ড এই ব্রাউজার সেশনের ডেমো টাইমলাইনে যোগ হয়েছে।`);
    } catch {
      setError("এই ব্রাউজার সেশনে রেকর্ড রাখা যায়নি। কোনো ডেটাবেসে পাঠানো হয়নি।");
    }
  }

  function refreshSessionTimeline() {
    setSessionTimeline(readPhotoImportTimeline());
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.backLink}>← ড্যাশবোর্ড</Link>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><span/></span><span>লাইফলুপ</span></div>
      <span className={styles.demoTag}>সিন্থেটিক ডেমো</span>
    </header>

    <div className={styles.content}>
      <section className={styles.intro}>
        <p className={styles.kicker}>AI সহায়তায় রিডিং আমদানি</p>
        <h1>ছবি থেকে খসড়া রিডিং</h1>
        <p>Gemini ছবি থেকে সম্ভাব্য তথ্য পড়বে। কোড ফরম্যাট ও একক যাচাই করবে। আপনার স্পষ্ট অনুমতি ছাড়া কিছুই টাইমলাইনে যোগ হবে না।</p>
      </section>

      <aside className={styles.privacyNotice}>
        <strong>শুধু সিন্থেটিক, পরিচয়বিহীন ডেমো ছবি ব্যবহার করুন</strong>
        <span>এই প্রোটোটাইপে আসল রোগীর তথ্য Gemini-তে পাঠাবেন না। Gemini API key শুধু সার্ভারে থাকে। লাইভ Gemini আর রেকর্ড করা নমুনা আলাদাভাবে চিহ্নিত হবে।</span>
      </aside>

      <section className={styles.pipeline} aria-label="AI pipeline">
        <div><span>০১</span><strong>Gemini প্রস্তাব করে</strong></div>
        <i aria-hidden="true"/>
        <div><span>০২</span><strong>কোড যাচাই করে</strong></div>
        <i aria-hidden="true"/>
        <div><span>০৩</span><strong>আপনি নিশ্চিত করেন</strong></div>
      </section>

      <section className={styles.importGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.kicker}>ছবি</p><h2>ডায়েরি বা মিটারের স্ক্রিন</h2></div>
            <span className={styles.stepMark}>১</span>
          </div>
          <label className={styles.filePicker}>
            <span className={styles.fileIcon} aria-hidden="true">＋</span>
            <span><strong>ছবি নির্বাচন করুন বা তুলুন</strong><small>JPEG, PNG অথবা WebP · সর্বোচ্চ ৮ MB</small></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={chooseFile}/>
          </label>
          <div className={styles.imageFrame}>
            {previewUrl ? <Image src={previewUrl} alt={usingRecordedImage ? "সিন্থেটিক ডায়েরি নমুনা" : "আপনার নির্বাচিত সিন্থেটিক ডেমো ছবি"} width={900} height={1120} unoptimized/> : <div className={styles.emptyPreview}><span className={styles.emptyIcon} aria-hidden="true">▧</span><strong>ছবির প্রিভিউ</strong><small>অথবা নির্ভরযোগ্য ডেমোর জন্য রেকর্ড করা নমুনা লোড করুন</small></div>}
            {previewUrl && <span className={styles.imageLabel}>{usingRecordedImage ? "রেকর্ড করা সিন্থেটিক নমুনা" : "নির্বাচিত ছবি"}</span>}
          </div>
          {imageFile && <label className={styles.consent}>
            <input type="checkbox" checked={syntheticConsent} onChange={(event) => setSyntheticConsent(event.target.checked)}/>
            <span>আমি নিশ্চিত, ছবিটি সিন্থেটিক ও পরিচয়বিহীন; Gemini-তে পাঠাতে সম্মতি দিচ্ছি।</span>
          </label>}
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="button" disabled={!imageFile || !syntheticConsent || loading} onClick={analyzeWithGemini}>
              {loading ? "Gemini ফল যাচাই হচ্ছে…" : "Gemini দিয়ে পড়ুন"}
            </button>
            <button className={styles.secondaryButton} type="button" disabled={loading} onClick={loadRecordedSample}>রেকর্ড করা নমুনা ফল</button>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.kicker}>পর্যালোচনা</p><h2>খসড়া তথ্য</h2></div>
            <span className={styles.stepMark}>২</span>
          </div>
          {!draftRows.length ? <div className={styles.emptyDraft}><strong>এখনও কোনো খসড়া নেই</strong><span>লাইভ Gemini চালান অথবা রেকর্ড করা নমুনা ফল লোড করুন।</span></div> : <>
            <div className={styles.modeRow}>
              <span className={mode === "live-gemini" ? styles.liveMode : styles.sampleMode}>
                {mode === "live-gemini" ? `Live Gemini${modelName ? ` · ${modelName}` : ""}` : "Recorded sample result · live AI নয়"}
              </span>
              {imageQuality && <span className={styles.quality}>ছবির মান: {imageQuality === "good" ? "ভালো" : imageQuality === "fair" ? "মাঝারি" : "দুর্বল"}</span>}
            </div>
            {draftRows.map((row, index) => {
              const issues = photoImportIssues(row);
              const lowConfidence = new Set(lowConfidenceFields(row));
              return <div className={styles.draftRow} key={row.id}>
                <div className={styles.rowHeading}><strong>রিডিং {index + 1}</strong><span>{row.previousConfirmedId && confirmedRowIds.includes(row.id) ? "এই সেশনে নিশ্চিত" : "যাচাই বাকি"}</span></div>
                <div className={styles.fieldGrid}>
                  {inputFields.map((field) => <label className={`${styles.field} ${lowConfidence.has(field) ? styles.lowConfidence : ""} ${row.editedFields.includes(field) ? styles.edited : ""}`} key={field}>
                    <span>{fieldLabels[field]}{lowConfidence.has(field) && <><span> </span><small>{mode === "recorded-sample" ? "কম · নমুনা রিভিউ" : "কম · মডেলের অনুমান"}</small></>}</span>
                    {field === "glucoseUnit" ? <select value={row.glucoseUnit ?? ""} onChange={(event) => updateRow(row.id, field, event.target.value)}>
                      <option value="">একক বাছুন</option><option value="mmol/L">mmol/L</option><option value="mg/dL">mg/dL</option>
                    </select> : <input
                      type={field === "date" ? "date" : field === "time" ? "time" : "text"}
                      inputMode={field === "date" || field === "time" ? undefined : "decimal"}
                      value={displayValue(row, field)}
                      onChange={(event) => updateRow(row.id, field, event.target.value)}
                      aria-label={`${fieldLabels[field]} · রিডিং ${index + 1}`}
                    />}
                    <small className={styles.confidence}>কনফিডেন্স {row.confidence[field].toFixed(2)}{mode === "recorded-sample" ? " · নমুনা" : " · মডেলের অনুমান"}</small>
                  </label>)}
                </div>
                <details className={styles.rawText}><summary>ছবিতে পড়া মূল লেখা দেখুন</summary><p>{row.rawText || "পাঠযোগ্য লেখা পাওয়া যায়নি।"}</p></details>
                {issues.length > 0 && <ul className={styles.issues}>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              </div>;
            })}
            <label className={styles.confirmCheck}>
              <input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)}/>
              <span>আমি প্রতিটি মান, একক ও হাইলাইট করা ঘর মূল ছবির সঙ্গে মিলিয়ে দেখেছি।</span>
            </label>
            <button className={styles.confirmButton} type="button" onClick={confirmRows} disabled={!reviewAcknowledged || hasBlockingIssues || allRowsConfirmed}>
              নিশ্চিত করে ডেমো টাইমলাইনে যোগ করুন
            </button>
          </>}
          {notice && <p className={styles.success} role="status">{notice}</p>}
        </article>
      </section>

      <section className={styles.timelineSection}>
        <div className={styles.panelHeading}>
          <div><p className={styles.kicker}>এই ট্যাব সেশন</p><h2>নিশ্চিত করা ছবি-রিডিং</h2></div>
          <button className={styles.refreshButton} type="button" onClick={refreshSessionTimeline}>সেশন তালিকা রিফ্রেশ</button>
        </div>
        {sessionTimeline.length === 0 ? <p className={styles.timelineEmpty}>নিশ্চিত রেকর্ড এখানে দেখা যাবে। এগুলো শুধু এই ব্রাউজার সেশনে থাকবে।</p> : <div className={styles.timelineList}>
          {sessionTimeline.map((record) => <article className={styles.timelineItem} key={record.id}>
            <div><strong>{record.date}</strong><small>{record.time || "সময় উল্লেখ নেই"}</small></div>
            <div className={styles.timelineMeasures}>
              {record.systolic !== null && record.diastolic !== null && <span>চাপ {record.systolic}/{record.diastolic} mmHg</span>}
              {record.pulse !== null && <span>পালস {record.pulse}</span>}
              {record.glucose !== null && <span>শর্করা {record.glucose} {record.glucoseUnit}</span>}
            </div>
            <span className={styles.provenance}>photo-import (confirmed)</span>
            {record.originalReadingId && <small className={styles.correctionNote}>সংশোধিত কপি; আগের রেকর্ড অক্ষত</small>}
          </article>)}
        </div>}
      </section>

      <footer className={styles.footer}>
        <span>এটি সিন্থেটিক ডেমো। Gemini শুধু খসড়া পড়ে; রোগ নির্ণয়, ঝুঁকি নির্ধারণ বা চিকিৎসা পরামর্শ দেয় না।</span>
        <Link href="/">ড্যাশবোর্ডে ফিরুন</Link>
      </footer>
    </div>
  </main>;
}
