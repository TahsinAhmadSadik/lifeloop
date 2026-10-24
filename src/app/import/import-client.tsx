"use client";

import Link from "next/link";
import React, { useState, useRef } from "react";

type ReadingDraft = {
  date: string;
  time: string;
  glucose: number | string;
  glucoseUnit: "mmol/L" | "mg/dL";
  systolic: number | string;
  diastolic: number | string;
  confidence: "high" | "medium" | "low";
  notes: string;
};

export default function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Draft readings extracted by AI
  const [drafts, setDrafts] = useState<ReadingDraft[]>([]);

  // Confirmed readings saved in current session
  const [savedRecords, setSavedRecords] = useState<ReadingDraft[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 8 * 1024 * 1024) {
        setError("ছবির সাইজ ৮ মেগাবাইটের বেশি হতে পারবে না।");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError(null);
      setIsSampleMode(false);
    }
  };

  // Instant Sample Demo Load (No image upload required)
  const handleLoadSample = () => {
    setError(null);
    setIsSampleMode(true);
    setPreviewUrl(
      "/demo_diary.jpeg"
    );
    setDrafts([
      {
        date: new Date().toISOString().split("T")[0],
        time: "সকাল (Morning)",
        glucose: 7.2,
        glucoseUnit: "mmol/L",
        systolic: 138,
        diastolic: 84,
        confidence: "high",
        notes: "নমুনা ডায়েরি থেকে খসড়া প্রস্তুত",
      },
    ]);
    setSuccess("রেকর্ড করা সিন্থেটিক নমুনা সফলভাবে লোড হয়েছে!");
  };

  // Client-side instant image compression helper (avoids Netlify 6MB & 10s timeouts)
  const compressImage = (fileToCompress: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileToCompress);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 800; // Reduced from 1200 to 800 for sub-3s inference
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Fast lightweight base64 (~50-80 KB)
          resolve(canvas.toDataURL("image/jpeg", 0.65));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleProcessImage = async () => {
    if (!file && !previewUrl) {
      setError("অনুগ্রহ করে একটি ছবি নির্বাচন করুন বা নমুনা লোড করুন।");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let payloadBase64 = previewUrl;

      // Compress client-side if a real file was uploaded
      if (file) {
        payloadBase64 = await compressImage(file);
      }

      const res = await fetch("/api/import/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: payloadBase64 }),
      });

      const data = await res.json();

      if (data.readings && data.readings.length > 0) {
        setDrafts(data.readings);
        if (data.isFallback) {
          setError("লাইভ এপিআই সাড়া দেয়নি, সুরক্ষার স্বার্থে নমুনা খসড়া দেখানো হচ্ছে।");
        } else {
          setSuccess("Gemini সফলভাবে ছবি থেকে রিডিং শনাক্ত করেছে!");
        }
      } else {
        throw new Error("ছবি থেকে কোনো সংখ্যা শনাক্ত করা যায়নি।");
      }
    } catch (err: any) {
      console.warn("Vision route fallback:", err);
      setError("ছবি প্রসেসিংয়ে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // Update draft reading values
  const handleDraftChange = (index: number, field: keyof ReadingDraft, val: any) => {
    const updated = [...drafts];
    updated[index] = { ...updated[index], [field]: val };
    setDrafts(updated);
  };

  // Save verified draft to session
  const handleSaveToTimeline = () => {
    if (!isVerified) return;
    setSavedRecords([...savedRecords, ...drafts]);
    setDrafts([]);
    setSuccess("রিডিংগুলো আপনার টাইমলাইনে সফলভাবে যোগ হয়েছে!");
    setIsVerified(false);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800 font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-emerald-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition"
          >
            <span className="text-lg">←</span> ড্যাশবোর্ডে ফিরুন
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-sm">
              L
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">লাইফলুপ</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              সিন্থেটিক ডেমো
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-8">
        {/* Intro */}
        <div className="max-w-2xl mb-6">
          <p className="text-xs font-bold text-emerald-700 tracking-wider uppercase mb-1">
            AI সহায়তায় রিডিং আমদানি
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            ছবি থেকে খসড়া রিডিং
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Gemini ছবি থেকে ডায়াবেটিস ও প্রেসারের তথ্য পড়বে এবং ফরম্যাট যাচাই করবে। আপনার স্পষ্ট
            অনুমতি ও যাচাই ছাড়া কোনো ডেটা টাইমলাইনে যুক্ত হবে না।
          </p>
        </div>

        {/* Privacy & Safety Warning */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3 text-amber-900 text-xs sm:text-sm">
          <div className="text-lg">⚠️</div>
          <div>
            <span className="font-bold">শুধু সিন্থেটিক, পরিচয়বিহীন ডেমো ছবি ব্যবহার করুন: </span>
            এই প্রোটোটাইপে আসল রোগীর ব্যক্তিগত পরিচয়যুক্ত তথ্য পাঠাবেন না। জেমিনাই শুধুমাত্র সম্ভাব্য
            মান প্রস্তাব করে; চিকিৎসকের বিকল্প হিসেবে কাজ করে না।
          </div>
        </div>

        {/* 3-Step Pipeline Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 mb-8 shadow-sm flex items-center justify-between gap-2 max-w-xl mx-auto text-xs sm:text-sm font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
              ১
            </span>
            <span>জেমিনাই পড়ে</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
              ২
            </span>
            <span>কোড যাচাই করে</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
              ৩
            </span>
            <span>আপনি নিশ্চিত করেন</span>
          </div>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl p-3.5 mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-rose-900">
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-3.5 mb-6 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="font-bold text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* 2-Column Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Image Ingestion (5 Cols) */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase">ধাপ ১</span>
                <h2 className="text-base font-bold text-slate-900">ডায়েরি বা মিটারের ছবি</h2>
              </div>
              {isSampleMode && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                  নমুনা মোড
                </span>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-200 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
                📷
              </div>
              <p className="text-sm font-bold text-slate-800">
                ছবি নির্বাচন করুন
              </p>
              <p className="text-xs text-slate-500">JPEG, PNG অথবা WebP · সর্বোচ্চ ৮ MB</p>
            </div>

            {/* Preview Area */}
            <div className="mt-4 border border-slate-200 rounded-xl bg-slate-50 min-h-[220px] max-h-[300px] flex items-center justify-center overflow-hidden relative">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full max-h-[300px] object-contain"
                  />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setIsSampleMode(false);
                      setDrafts([]);
                    }}
                    className="absolute top-2 right-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
                    title="ছবি মুছুন"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <p className="text-2xl mb-1">🖼️</p>
                  <p className="text-xs font-semibold">কোনো ছবি নির্বাচন করা হয়নি</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    নিচের বাটন দিয়ে একটি নমুনা ছবি লোড করে দেখতে পারেন
                  </p>
                </div>
              )}
            </div>

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2.5 mt-4 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
              />
              <span>আমি নিশ্চিত করছি যে এতে কোনো রোগীর ব্যক্তিগত সংবেদনশীল তথ্য নেই।</span>
            </label>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={handleProcessImage}
                disabled={loading || (!file && !previewUrl) || !hasConsent}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-base">⏳</span> তথ্য পড়া হচ্ছে...
                  </>
                ) : (
                  <>
                    <span>✨</span> Gemini দিয়ে পড়ুন
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition"
              >
                নমুনা রেকর্ড লোড করুন
              </button>
            </div>
          </section>

          {/* Right Column: Draft Review & Verification (7 Cols) */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase">ধাপ ২</span>
                <h2 className="text-base font-bold text-slate-900">পর্যালোচনা ও খসড়া ডেটা</h2>
              </div>
              {drafts.length > 0 && (
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  {drafts.length} টি রিডিং প্রস্তুত
                </span>
              )}
            </div>

            {drafts.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-400 min-h-[340px] flex flex-col items-center justify-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm font-bold text-slate-600">এখনও কোনো খসড়া তথ্য নেই</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  বামে একটি ডায়াবেটিস ডায়েরি বা মিটারের ছবি আপলোড করে "Gemini দিয়ে পড়ুন" বাটনে চাপ
                  দিন, অথবা দ্রুত টেস্ট করতে "নমুনা রেকর্ড লোড করুন"।
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((d, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-700">রিডিং #{idx + 1}</span>
                      <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        উচ্চ আস্থা (High Confidence)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Date */}
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">তারিখ</label>
                        <input
                          type="date"
                          value={d.date}
                          onChange={(e) => handleDraftChange(idx, "date", e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-emerald-600 font-medium"
                        />
                      </div>

                      {/* Time */}
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">সময় / বেলা</label>
                        <input
                          type="text"
                          value={d.time}
                          onChange={(e) => handleDraftChange(idx, "time", e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-emerald-600 font-medium"
                        />
                      </div>

                      {/* Glucose */}
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">
                          রক্তে শর্করা (Glucose)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={d.glucose}
                            onChange={(e) =>
                              handleDraftChange(idx, "glucose", parseFloat(e.target.value) || "")
                            }
                            className="w-2/3 bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-emerald-600 font-bold"
                          />
                          <select
                            value={d.glucoseUnit}
                            onChange={(e) => handleDraftChange(idx, "glucoseUnit", e.target.value)}
                            className="w-1/3 bg-white border border-slate-300 rounded-lg p-2 text-slate-700 font-medium text-xs"
                          >
                            <option value="mmol/L">mmol/L</option>
                            <option value="mg/dL">mg/dL</option>
                          </select>
                        </div>
                      </div>

                      {/* Blood Pressure */}
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">
                          রক্তচাপ (BP Systolic / Diastolic)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="সিস্টোলিক"
                            value={d.systolic}
                            onChange={(e) =>
                              handleDraftChange(idx, "systolic", parseInt(e.target.value, 10) || "")
                            }
                            className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-emerald-600 font-bold"
                          />
                          <span className="text-slate-400">/</span>
                          <input
                            type="number"
                            placeholder="ডায়াস্টোলিক"
                            value={d.diastolic}
                            onChange={(e) =>
                              handleDraftChange(idx, "diastolic", parseInt(e.target.value, 10) || "")
                            }
                            className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-emerald-600 font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="text-xs">
                      <label className="block text-slate-500 font-semibold mb-1">নোট / বিবরণ</label>
                      <input
                        type="text"
                        value={d.notes}
                        onChange={(e) => handleDraftChange(idx, "notes", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-700 text-xs"
                      />
                    </div>
                  </div>
                ))}

                {/* Final Verification Check */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 font-medium cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={isVerified}
                      onChange={(e) => setIsVerified(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
                    />
                    <span>আমি প্রতিটি মান ও একক মূল ডায়েরি/মিটারের সাথে মিলিয়ে দেখেছি।</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveToTimeline}
                    disabled={!isVerified}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm transition"
                  >
                    টাইমলাইনে নিশ্চিত রিডিং যোগ করুন
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom Section: Current Session Timeline */}
        <section className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase">রেকর্ড হিস্ট্রি</span>
              <h2 className="text-base font-bold text-slate-900">এই সেশনে নিশ্চিত করা রিডিং</h2>
            </div>
            {savedRecords.length > 0 && (
              <button
                onClick={() => setSavedRecords([])}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                তালিকা পরিষ্কার করুন
              </button>
            )}
          </div>

          {savedRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              এই সেশনে এখনও কোনো ছবি-রিডিং সংরক্ষণ করা হয়নি। উপরের খসড়া নিশ্চিত করলে তা এখানে দেখা
              যাবে।
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {savedRecords.map((r, i) => (
                <div key={i} className="py-3 flex items-center justify-between text-xs sm:text-sm">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-800">
                      তারিখ: {r.date} ({r.time})
                    </p>
                    <p className="text-slate-500 text-xs">উৎস: {r.notes || "ছবি আমদানি"}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-emerald-700">
                      গ্লুকোজ: {r.glucose} {r.glucoseUnit}
                    </span>
                    <span className="font-semibold text-sky-700">
                      রক্তচাপ: {r.systolic}/{r.diastolic} mmHg
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                      সংরক্ষিত
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400">
          লাইফলুপ প্রোটোটাইপ · এটি সিন্থেটিক ডেমো · Gemini শুধু ডেটা এক্সট্র্যাক্ট করে; কোনো প্রেসক্রিপশন বা ডায়াগনোসিস দেয় না।
        </footer>
      </main>
    </div>
  );
}