"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeDemoSeries, createDemoSeries, demoMetricValue, type DemoMetric, type DemoScenario } from "@/lib/demo-health";
import { demoShareStorageKey, rafiDemoReadings, type DemoSharePayload } from "@/lib/demo-patients";
import { glucoseToMgdl, mgdlToMmol, parseLocalizedNumber, type GlucoseUnit } from "@/lib/health";

type Reading = { id: number; date: string; glucoseMgDl: number; systolic: number; diastolic: number; time: string; source: "sample" | "manual-demo" | "ai-draft-demo" };
type View = "overview" | "routine" | "learning" | "clinician";
type ShareStep = "choose" | "qr";
type ShifaAction = "open_routine" | "open_share" | "open_entry" | "open_learning" | null;
type ShifaMessage = { id: string; role: "assistant" | "user"; text: string; basis?: string; mode?: "ai" | "demo-fallback"; action?: ShifaAction };

const initialReadings: Reading[] = rafiDemoReadings.map((reading) => ({ ...reading, glucoseMgDl: reading.glucoseMgDl ?? 0, systolic: reading.systolic ?? 0, diastolic: reading.diastolic ?? 0 }));

const routineItems = [
  { id: "measure", title: "আজকের রিডিং লিখেছি", detail: "আপনার নির্ধারিত মাপার সময় অনুযায়ী" },
  { id: "movement", title: "আজকের চলাফেরা নোট করেছি", detail: "পদক্ষেপ বা নিজের ছোট নোট" },
  { id: "meal", title: "খাবারের একটি নোট রেখেছি", detail: "ঐচ্ছিক, কোনো পুষ্টি-স্কোর নয়" },
  { id: "sleep", title: "ঘুমের সময় লিখেছি", detail: "ডিভাইস থাকলে আনুমানিক তথ্য" },
];

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v3H9zM8 11h8M8 15h6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    heart: <><path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/></>,
    heartFilled: <path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" fill="currentColor" stroke="none"/>,
    drop: <><path d="M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z"/><path d="M9 16a3 3 0 0 0 3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    moon: <><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></>,
    steps: <><path d="M7 20c-2 0-3-1.5-2-3.5l2-4c1-2 3-1.5 3.5.5l1 4C12 19 10 20 7 20ZM16 14c-1.5 0-2.3-1.1-1.7-2.6l1.2-2.5c.7-1.3 2-1 2.4.3l.7 2.5c.4 1.4-.9 2.3-2.6 2.3Z"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.chart}</svg>;
}

function bengali(value: number, digits = 1) {
  return new Intl.NumberFormat("bn-BD", { maximumFractionDigits: digits }).format(value);
}

function sourceName(source: Reading["source"]) {
  if (source === "sample") return "নমুনা তথ্য";
  if (source === "ai-draft-demo") return "এআই খসড়া যাচাই";
  return "ডেমোতে লেখা";
}

function TrendChart({ readings, metric }: { readings: Reading[]; metric: "glucose" | "pressure" }) {
  const values = readings.slice(-7).map((reading) => metric === "glucose" ? mgdlToMmol(reading.glucoseMgDl) : reading.systolic);
  const min = Math.min(...values) - (metric === "glucose" ? 0.6 : 9);
  const max = Math.max(...values) + (metric === "glucose" ? 0.6 : 9);
  const x = (index: number) => 30 + index * (540 / Math.max(values.length - 1, 1));
  const y = (value: number) => 150 - ((value - min) / (max - min)) * 118;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `30,150 ${points} ${x(values.length - 1)},150`;
  return <svg className="trend-chart" viewBox="0 0 600 180" role="img" aria-label={metric === "glucose" ? "নমুনা রক্তে শর্করার প্রবণতা" : "নমুনা রক্তচাপের প্রবণতা"}>
    <defs><linearGradient id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#397b60" stopOpacity=".13"/><stop offset="100%" stopColor="#397b60" stopOpacity="0"/></linearGradient></defs>
    {[32, 71, 110, 149].map((line) => <line key={line} x1="30" y1={line} x2="570" y2={line} stroke="#edf0eb"/>)}
    <polygon points={area} fill={`url(#fill-${metric})`}/><polyline points={points} fill="none" stroke="#397b60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="3.5" fill="#fff" stroke="#397b60" strokeWidth="2"/>)}
  </svg>;
}

function DemoChart({ series, metric }: { series: ReturnType<typeof createDemoSeries>; metric: DemoMetric }) {
  const values = series.map((day) => demoMetricValue(day, metric));
  const baseline = values.slice(0, 14).filter((value): value is number => value !== null);
  const present = values.filter((value): value is number => value !== null);
  const median = (numbers: number[]) => {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const center = baseline.length ? median(baseline) : 0;
  const mad = baseline.length ? median(baseline.map((value) => Math.abs(value - center))) : 0;
  const padding = metric === "glucose" ? 0.5 : metric === "steps" ? 1000 : 5;
  const min = Math.min(...present, center - mad * 2) - padding;
  const max = Math.max(...present, center + mad * 2) + padding;
  const x = (index: number) => 28 + index * (544 / Math.max(values.length - 1, 1));
  const y = (value: number) => 150 - ((value - min) / Math.max(max - min, 1)) * 118;
  const points = values.map((value, index) => value === null ? "" : `${x(index)},${y(value)}`).filter(Boolean).join(" ");
  const upper = y(center + Math.max(mad, padding * 0.3));
  const lower = y(center - Math.max(mad, padding * 0.3));
  return <svg className="demo-chart" viewBox="0 0 600 180" role="img" aria-label="সিন্থেটিক নমুনায় ব্যক্তিগত বেসলাইন এবং সময়ের সঙ্গে মানের পরিবর্তন">
    {[32, 71, 110, 149].map((line) => <line key={line} x1="28" y1={line} x2="572" y2={line} stroke="#edf0eb"/>)}
    {baseline.length >= 10 && <rect x="28" y={Math.min(upper, lower)} width="544" height={Math.max(2, Math.abs(lower - upper))} fill="#e9f1e8"/>}
    {baseline.length >= 10 && <line x1="28" y1={y(center)} x2="572" y2={y(center)} stroke="#78927c" strokeWidth="1.5"/>}
    <polyline points={points} fill="none" stroke="#397b60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {values.map((value, index) => value === null ? <circle key={index} cx={x(index)} cy="165" r="2" fill="#c5cbc2"/> : <circle key={index} cx={x(index)} cy={y(value)} r="3" fill="#fff" stroke="#397b60" strokeWidth="2"/>)}
  </svg>;
}

function DemoQr({ token }: { token: string }) {
  const size = 25;
  const seed = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const inFinder = (row < 7 && column < 7) || (row < 7 && column >= size - 7) || (row >= size - 7 && column < 7);
    if (inFinder) {
      const localRow = row < 7 ? row : row - (size - 7);
      const localColumn = column < 7 ? column : column - (size - 7);
      return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6 || (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4);
    }
    return (row * 17 + column * 11 + seed + (row * column) % 13) % 3 !== 0;
  });
  return <svg className="fake-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="সিমুলেটেড, স্ক্যান করা যায় না এমন QR চিত্র">
    <rect width={size} height={size} fill="#fff"/>{cells.map((filled, index) => filled && <rect key={index} x={index % size} y={Math.floor(index / size)} width="1" height="1" fill="#263b31"/>)}
  </svg>;
}

export default function Home() {
  const router = useRouter();
  const [readings, setReadings] = useState(initialReadings);
  const [view, setView] = useState<View>("overview");
  const [metric, setMetric] = useState<"glucose" | "pressure">("glucose");
  const [showEntry, setShowEntry] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareStep, setShareStep] = useState<ShareStep>("choose");
  const [sharePeriod, setSharePeriod] = useState("all");
  const [shareGlucose, setShareGlucose] = useState(true);
  const [sharePressure, setSharePressure] = useState(true);
  const [demoToken, setDemoToken] = useState("DEMO-4821");
  const [shareError, setShareError] = useState("");
  const [entryMode, setEntryMode] = useState<"manual" | "checkin">("manual");
  const [checkinText, setCheckinText] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [entryError, setEntryError] = useState("");
  const [draftNeedsReview, setDraftNeedsReview] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [glucoseUnit, setGlucoseUnit] = useState<GlucoseUnit | "">("mmol/L");
  const [glucose, setGlucose] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [routineDone, setRoutineDone] = useState<string[]>([]);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("gradual-change");
  const [demoDay, setDemoDay] = useState(28);
  const [demoMetric, setDemoMetric] = useState<DemoMetric>("glucose");
  const [showShifa, setShowShifa] = useState(false);
  const [shifaConsent, setShifaConsent] = useState(false);
  const [shifaQuestion, setShifaQuestion] = useState("");
  const [shifaSending, setShifaSending] = useState(false);
  const [shifaError, setShifaError] = useState("");
  const [shifaMessages, setShifaMessages] = useState<ShifaMessage[]>([{ id: "welcome", role: "assistant", text: "আমি শিফা, লাইফলুপের সহকারী। দেখানো নমুনা রিডিং বুঝতে, ডেমো রুটিন দেখতে বা ডাক্তার-সারাংশের খসড়া খুলতে সাহায্য করতে পারি। আমি রোগ নির্ণয় বা চিকিৎসার পরামর্শ দিই না।" }]);

  const latest = readings[readings.length - 1];
  const averageGlucose = useMemo(() => mgdlToMmol(readings.reduce((sum, item) => sum + item.glucoseMgDl, 0) / readings.length), [readings]);
  const averageSystolic = useMemo(() => readings.reduce((sum, item) => sum + item.systolic, 0) / readings.length, [readings]);
  const averageDiastolic = useMemo(() => readings.reduce((sum, item) => sum + item.diastolic, 0) / readings.length, [readings]);
  const glucoseChange = mgdlToMmol(latest.glucoseMgDl - readings[0].glucoseMgDl);
  const pressureChange = latest.systolic - readings[0].systolic;
  const midpoint = Math.floor(readings.length / 2);
  const firstPeriod = readings.slice(0, midpoint);
  const secondPeriod = readings.slice(midpoint);
  const glucoseDelta = mgdlToMmol(secondPeriod.reduce((sum, item) => sum + item.glucoseMgDl, 0) / secondPeriod.length - firstPeriod.reduce((sum, item) => sum + item.glucoseMgDl, 0) / firstPeriod.length);
  const pressureDelta = secondPeriod.reduce((sum, item) => sum + item.systolic, 0) / secondPeriod.length - firstPeriod.reduce((sum, item) => sum + item.systolic, 0) / firstPeriod.length;
  const explanation = readings.length < 5
    ? "এই নমুনা প্রবণতা দেখানোর জন্য আরও কিছু তথ্য প্রয়োজন। এটি কোনো রোগ নির্ণয় নয়।"
    : `নমুনা তথ্যের দুই সময়পর্বের তুলনায় রক্তে শর্করা ${bengali(Math.abs(glucoseDelta))} mmol/L ${glucoseDelta >= 0 ? "বেশি" : "কম"} এবং সিস্টোলিক রক্তচাপ ${bengali(Math.abs(pressureDelta))} mmHg ${pressureDelta >= 0 ? "বেশি" : "কম"}। এটি একটি সরল ডেমো তুলনা, ব্যক্তিগত বেসলাইন বা চিকিৎসা-সংক্রান্ত সিদ্ধান্ত নয়।`;
  const demoSeries = useMemo(() => createDemoSeries(demoScenario).slice(0, demoDay), [demoScenario, demoDay]);
  const demoAnalysis = useMemo(() => analyzeDemoSeries(demoSeries), [demoSeries]);
  const checkedCount = routineDone.length;
  const viewLabels: Record<View, string> = { overview: "আমার সারাংশ", routine: "দৈনিক অভ্যাস", learning: "বেসলাইন ডেমো", clinician: "ডাক্তারের ভিউ" };

  function openShare() {
    setShareStep("choose");
    setShareError("");
    setShowShare(true);
  }

  function createDemoShare() {
    setDemoToken(`DEMO-${String(Date.now()).slice(-4)}`);
    setShareStep("qr");
  }

  function simulateDoctorScan() {
    const createdAt = Date.now();
    const selectedRecords = (sharePeriod === "week" ? readings.slice(-7) : readings).map((reading) => ({
      ...reading,
      glucoseMgDl: shareGlucose ? reading.glucoseMgDl : null,
      systolic: sharePressure ? reading.systolic : null,
      diastolic: sharePressure ? reading.diastolic : null,
    }));
    const share: DemoSharePayload = {
      version: 1,
      token: demoToken,
      patientId: "rafi-demo",
      period: sharePeriod === "week" ? "week" : "all",
      glucose: shareGlucose,
      pressure: sharePressure,
      createdAt,
      expiresAt: createdAt + 15 * 60 * 1000,
      records: selectedRecords,
    };
    try {
      sessionStorage.setItem(demoShareStorageKey, JSON.stringify(share));
      setShowShare(false);
      router.push("/doctor-demo");
    } catch {
      setShareError("এই ব্রাউজারে ডেমো সেশন তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    }
  }

  function saveReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const glucoseValue = parseLocalizedNumber(glucose);
    const systolicValue = parseLocalizedNumber(systolic);
    const diastolicValue = parseLocalizedNumber(diastolic);
    if (glucoseValue === null || systolicValue === null || diastolicValue === null || glucoseValue <= 0 || systolicValue <= 0 || diastolicValue <= 0) {
      setEntryError("প্রতিটি ঘরে সঠিক ধনাত্মক সংখ্যা লিখুন। বাংলা বা ইংরেজি অঙ্ক ব্যবহার করা যাবে।");
      return;
    }
    if (draftNeedsReview && !reviewConfirmed) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" }).format(now);
    const time = new Intl.DateTimeFormat("bn-BD", { hour: "numeric", minute: "2-digit" }).format(now);
    setReadings((current) => [...current, { id: Date.now(), date, time, glucoseMgDl: glucoseToMgdl(glucoseValue, glucoseUnit || "mmol/L"), systolic: systolicValue, diastolic: diastolicValue, source: draftNeedsReview ? "ai-draft-demo" : "manual-demo" }]);
    setGlucose(""); setSystolic(""); setDiastolic(""); setCheckinText(""); setShowEntry(false);
    setDraftNeedsReview(false); setReviewConfirmed(false); setAiConsent(false); setEntryMode("manual"); setEntryError("");
  }

  async function parseCheckin() {
    setGlucose(""); setSystolic(""); setDiastolic(""); setGlucoseUnit("");
    setDraftNeedsReview(false); setReviewConfirmed(false); setEntryError("");
    setIsParsing(true);
    setParseError("");
    try {
      const response = await fetch("/api/checkin/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: checkinText }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "রিডিং তৈরি করা যায়নি। হাতে লিখে দিন।");
      const draft = payload.draft as { glucose: number | null; glucoseUnit: GlucoseUnit | "unknown"; systolic: number | null; diastolic: number | null; needsClarification: boolean };
      setGlucose(draft.glucose === null ? "" : String(draft.glucose));
      setGlucoseUnit(draft.glucoseUnit === "unknown" ? "" : draft.glucoseUnit);
      setSystolic(draft.systolic === null ? "" : String(draft.systolic));
      setDiastolic(draft.diastolic === null ? "" : String(draft.diastolic));
      setDraftNeedsReview(true);
      setReviewConfirmed(false);
      if (draft.needsClarification) setParseError("কিছু তথ্য অস্পষ্ট বা অনুপস্থিত। খালি ঘরগুলো নিজে পূরণ করুন এবং মূল রিডিংয়ের সঙ্গে মিলিয়ে নিন।");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "রিডিং তৈরি করা যায়নি। হাতে লিখে দিন।");
      setDraftNeedsReview(false);
    } finally {
      setIsParsing(false);
    }
  }

  function openEntry() {
    setGlucose(""); setSystolic(""); setDiastolic(""); setCheckinText("");
    setGlucoseUnit("mmol/L"); setEntryMode("manual"); setDraftNeedsReview(false);
    setReviewConfirmed(false); setAiConsent(false); setParseError(""); setEntryError(""); setShowEntry(true);
  }

  const navItems: { view: View; title: string; icon: string }[] = [
    { view: "overview", title: "সারাংশ", icon: "home" },
    { view: "routine", title: "দৈনিক অভ্যাস", icon: "clipboard" },
    { view: "learning", title: "বেসলাইন ডেমো", icon: "chart" },
  ];

  async function askShifa(question: string) {
    if (!shifaConsent) {
      setShifaError("শিফাকে প্রশ্ন পাঠানোর আগে সম্মতি দিন।");
      return;
    }
    const trimmed = question.trim();
    if (!trimmed || shifaSending) return;
    setShifaMessages((messages) => [...messages, { id: `user-${Date.now()}`, role: "user", text: trimmed }]);
    setShifaQuestion("");
    setShifaError("");
    setShifaSending(true);
    try {
      const response = await fetch("/api/shifa/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          readings: readings.map(({ glucoseMgDl, systolic, diastolic, date, time }) => ({ glucoseMgDl, systolic, diastolic, date, time })),
          routineDone: routineDone.length,
        }),
      });
      const result = await response.json() as { error?: string; answer?: string; basis?: string; action?: ShifaAction; mode?: "ai" | "demo-fallback" };
      if (!response.ok || !result.answer) throw new Error(result.error || "শিফা এখন উত্তর দিতে পারছে না।");
      setShifaMessages((messages) => [...messages, { id: `assistant-${Date.now()}`, role: "assistant", text: result.answer!, basis: result.basis, action: result.action ?? null, mode: result.mode }]);
    } catch (error) {
      setShifaError(error instanceof Error ? error.message : "শিফা এখন উত্তর দিতে পারছে না।");
    } finally {
      setShifaSending(false);
    }
  }

  function runShifaAction(action: ShifaAction) {
    setShowShifa(false);
    if (action === "open_routine") setView("routine");
    if (action === "open_learning") setView("learning");
    if (action === "open_entry") openEntry();
    if (action === "open_share") openShare();
  }

  return <div className="app-shell" lang="bn">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => setView("overview")} aria-label="লাইফলুপ হোম"><span className="brand-mark"><Icon name="heart" size={19}/></span><span className="brand-name">লাইফলুপ</span></a>
      <div className="workspace-label">ডেমো স্বাস্থ্য অ্যাপ</div>
      <nav className="nav-list" aria-label="প্রধান মেনু">
        {navItems.map((item) => <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => setView(item.view)}><Icon name={item.icon}/>{item.title}</button>)}
        <button className={`nav-item ${view === "clinician" ? "active" : ""}`} onClick={openShare}><Icon name="share"/>ডাক্তারের সঙ্গে ভাগ</button>
      </nav>
      <div className="sidebar-note"><Icon name="shield" size={16}/><p>সব রেকর্ড নমুনা বা এই ডেমোতে লেখা। কোনো বাস্তব ক্লিনিকে পাঠানো হয় না।</p></div>
      <div className="sidebar-profile"><div className="avatar">রা</div><div><strong>রাফি আহমেদ</strong><span>নমুনা প্রোফাইল</span></div></div>
    </aside>

    <main className="main-area" id="overview">
      <header className="topbar"><div className="breadcrumb">লাইফলুপ ডেমো <span>/</span> <strong>{viewLabels[view]}</strong></div><span className="profile-top"><span className="avatar small">রা</span><span>রাফি আহমেদ</span></span></header>
      <div className="content-wrap">
        {view === "overview" && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="status-dot"/> নমুনা স্বাস্থ্য প্রোফাইল</div><h1>সুপ্রভাত, রাফি</h1><p className="welcome-copy">এই ডেমোতে নিজের রিডিং দেখুন, অভ্যাস নোট করুন এবং শেয়ার প্রবাহটি ঘুরে দেখুন।</p></div><span className="date-pill"><Icon name="calendar" size={16}/> ১২ থেকে ১৮ অক্টোবর, ২০২৬</span></section>
          <div className="demo-banner"><Icon name="shield" size={16}/><span>নমুনা তথ্য দিয়ে তৈরি প্রোটোটাইপ। কোনো বাস্তব ডিভাইস, চিকিৎসক বা স্বাস্থ্য রেকর্ডের সঙ্গে সংযুক্ত নয়।</span></div>
          <section className="summary-grid" aria-label="নমুনা স্বাস্থ্য পরিমাপ">
            <article className="metric-card"><div className="metric-top"><span className="metric-icon glucose-icon"><Icon name="drop" size={18}/></span><span className="metric-label">রক্তে শর্করা</span></div><div className="metric-value">{bengali(mgdlToMmol(latest.glucoseMgDl))} <span>mmol/L</span></div><div className="metric-bottom"><span>সর্বশেষ · {latest.time}</span><span>প্রথম রিডিং থেকে <b>{bengali(Math.abs(glucoseChange))} {glucoseChange >= 0 ? "বেশি" : "কম"}</b></span></div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-icon pressure-icon"><Icon name="heart" size={18}/></span><span className="metric-label">রক্তচাপ</span></div><div className="metric-value">{bengali(latest.systolic)}<span className="slash">/</span>{bengali(latest.diastolic)} <span>mmHg</span></div><div className="metric-bottom"><span>সর্বশেষ · {latest.time}</span><span>প্রথম রিডিং থেকে <b>{bengali(Math.abs(pressureChange))} mmHg {pressureChange >= 0 ? "বেশি" : "কম"}</b></span></div></article>
            <article className="metric-card pattern-card"><div className="metric-top"><span className="metric-icon pattern-icon"><Icon name="chart" size={18}/></span><span className="metric-label">নমুনা তথ্যের তুলনা</span><span className="period-label">{bengali(readings.length)}টি রিডিং</span></div><div className="pattern-title">{glucoseDelta >= 0 && pressureDelta >= 0 ? "দুই মানই পরের সময়ে বেশি" : glucoseDelta <= 0 && pressureDelta <= 0 ? "দুই মানই পরের সময়ে কম" : "দুই মানের পরিবর্তন একরকম নয়"}</div><div className="pattern-copy">{explanation}</div><button className="text-link" onClick={() => setView("learning")}>বেসলাইন ডেমো দেখুন <Icon name="arrow" size={14}/></button></article>
          </section>
          <section className="main-grid"><article className="panel trend-panel"><div className="panel-header"><div><div className="section-kicker">নমুনা রিডিং</div><h2>সময়ের সঙ্গে পরিবর্তন</h2></div><div className="segmented"><button className={metric === "glucose" ? "selected" : ""} onClick={() => setMetric("glucose")}>শর্করা</button><button className={metric === "pressure" ? "selected" : ""} onClick={() => setMetric("pressure")}>রক্তচাপ</button></div></div><div className="chart-caption"><span>{metric === "glucose" ? "রক্তে শর্করা" : "সিস্টোলিক রক্তচাপ"} <span className="chart-unit">({metric === "glucose" ? "mmol/L" : "mmHg"})</span></span><span className="chart-average">সাপ্তাহিক গড় <strong>{metric === "glucose" ? bengali(averageGlucose) : bengali(averageSystolic)} {metric === "glucose" ? "mmol/L" : "mmHg"}</strong></span></div><TrendChart readings={readings} metric={metric}/><div className="chart-dates">{readings.slice(-7).map((item, index) => <span key={`${item.id}-${index}`}>{item.date}</span>)}</div><div className="chart-footnote"><span className="chart-legend-dot"/> ডেমো রেকর্ড <span className="chart-source">উদাহরণ, ব্যক্তিগত স্বাস্থ্য বিশ্লেষণ নয়</span></div></article>
            <article className="panel insight-panel"><div className="insight-heading"><span className="insight-spark"><Icon name="chart" size={17}/></span><div><div className="section-kicker">সরল তুলনা</div><h2>এই কার্ড কী দেখায়</h2></div></div><div className="insight-callout"><span className="callout-line"/><p>{explanation}</p></div><div className="insight-foot"><span className="info-dot">i</span><span>এটি শুধু নমুনা ডেটার তুলনা। কোনো বেসলাইন, রোগ নির্ণয় বা ভবিষ্যদ্বাণী নয়।</span></div><button className="insight-link" onClick={openShare}>ডাক্তারের ভিউ ডেমো করুন <Icon name="arrow" size={15}/></button></article></section>
          <section className="bottom-grid"><article className="panel recent-panel"><div className="panel-header"><div><div className="section-kicker">সাম্প্রতিক নমুনা</div><h2>রিডিংয়ের তালিকা</h2></div><button className="quiet-link" onClick={() => setView("learning")}>বেসলাইন পরীক্ষা <Icon name="arrow" size={14}/></button></div><div className="reading-table"><div className="table-head"><span>তারিখ ও সময়</span><span>শর্করা</span><span>রক্তচাপ</span><span>তথ্যের ধরন</span></div>{readings.slice(-4).reverse().map((reading) => <div className="reading-row" key={reading.id}><span className="reading-date"><strong>{reading.date}</strong><small>{reading.time}</small></span><span>{bengali(mgdlToMmol(reading.glucoseMgDl))} <small>mmol/L</small></span><span>{bengali(reading.systolic)}/{bengali(reading.diastolic)} <small>mmHg</small></span><span className="source-chip"><span/>{sourceName(reading.source)}</span></div>)}</div></article>
            <article className="panel routine-panel"><div className="panel-header"><div><div className="section-kicker">দৈনিক অভ্যাস</div><h2>আজকের ডেমো অগ্রগতি</h2></div><span className="routine-mark"><Icon name="clipboard" size={18}/></span></div><div className="routine-progress"><span style={{ width: `${(checkedCount / routineItems.length) * 100}%` }}/></div><div className="routine-quote">{bengali(checkedCount, 0)} / {bengali(routineItems.length, 0)}টি অভ্যাস চিহ্নিত</div><div className="routine-note">নমুনা কাজগুলো শুধু ইন্টারফেস দেখানোর জন্য।</div><button className="routine-action" onClick={() => setView("routine")}>অভ্যাস খুলুন <Icon name="arrow" size={14}/></button></article></section>
          <section className="bottom-actions"><div className="last-updated"><span className="live-dot"/> নতুন রিডিং শুধু এই ডেমো সেশনে থাকে</div><button className="primary-button" onClick={openEntry}><Icon name="plus" size={18}/> রিডিং যোগ করুন</button></section>
        </>}

        {view === "routine" && <RoutinePage done={routineDone} onToggle={(id) => setRoutineDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onOpenEntry={openEntry}/>}
        {view === "learning" && <LearningPage scenario={demoScenario} setScenario={setDemoScenario} day={demoDay} setDay={setDemoDay} metric={demoMetric} setMetric={setDemoMetric} series={demoSeries} analysis={demoAnalysis}/>}
        {view === "clinician" && <ClinicianPage readings={readings} averageGlucose={averageGlucose} averageSystolic={averageSystolic} averageDiastolic={averageDiastolic} sharePeriod={sharePeriod} shareGlucose={shareGlucose} sharePressure={sharePressure} onRevoke={() => setView("overview")}/>}

        <footer className="disclaimer"><Icon name="shield" size={15}/><span>লাইফলুপ প্রোটোটাইপ · সব নমুনা তথ্য কাল্পনিক · কোনো বাস্তব ডিভাইস, চিকিৎসক বা স্বাস্থ্য রেকর্ড সংযুক্ত নয়</span></footer>
      </div>
    </main>

    <nav className="mobile-nav" aria-label="মোবাইল মেনু">{[
      { view: "overview" as View, title: "সারাংশ", icon: "home" },
      { view: "routine" as View, title: "অভ্যাস", icon: "clipboard" },
      { view: "learning" as View, title: "বেসলাইন", icon: "chart" },
      { view: "clinician" as View, title: "ডাক্তার", icon: "share" },
    ].map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => item.view === "clinician" ? openShare() : setView(item.view)}><Icon name={item.icon} size={18}/><span>{item.title}</span></button>)}</nav>

    <button className="shifa-launcher" onClick={() => setShowShifa(true)} aria-label="শিফা সহকারী খুলুন"><span className="shifa-launcher-mark"><Icon name="heartFilled" size={17}/></span><span>শিফা</span></button>

    {showShifa && <ShifaPanel messages={shifaMessages} question={shifaQuestion} setQuestion={setShifaQuestion} consent={shifaConsent} setConsent={setShifaConsent} sending={shifaSending} error={shifaError} contextLabel={viewLabels[view]} onAsk={askShifa} onAction={runShifaAction} onClose={() => setShowShifa(false)}/>}

    {showEntry && <EntryModal
      entryMode={entryMode} setEntryMode={setEntryMode} glucose={glucose} setGlucose={setGlucose} systolic={systolic} setSystolic={setSystolic} diastolic={diastolic} setDiastolic={setDiastolic} glucoseUnit={glucoseUnit} setGlucoseUnit={setGlucoseUnit}
      checkinText={checkinText} setCheckinText={setCheckinText} aiConsent={aiConsent} setAiConsent={setAiConsent} isParsing={isParsing} parseError={parseError} entryError={entryError} draftNeedsReview={draftNeedsReview} setDraftNeedsReview={setDraftNeedsReview} reviewConfirmed={reviewConfirmed} setReviewConfirmed={setReviewConfirmed}
      onParse={parseCheckin} onSave={saveReading} onClose={() => setShowEntry(false)} onOpenPhoto={() => { setShowEntry(false); router.push("/import"); }}
    />}

    {showShare && <ShareModal step={shareStep} period={sharePeriod} setPeriod={setSharePeriod} glucose={shareGlucose} setGlucose={setShareGlucose} pressure={sharePressure} setPressure={setSharePressure} token={demoToken} error={shareError} onCreate={createDemoShare} onSimulateScan={simulateDoctorScan} onClose={() => setShowShare(false)}/>}
  </div>;
}

function RoutinePage({ done, onToggle, onOpenEntry }: { done: string[]; onToggle: (id: string) => void; onOpenEntry: () => void }) {
  return <section className="feature-page"><div className="welcome-row"><div><div className="eyebrow"><span className="status-dot"/> নমুনা রুটিন</div><h1>আজকের অভ্যাস</h1><p className="welcome-copy">ডায়াবেটিস ও উচ্চ রক্তচাপের দৈনন্দিন যত্ন দেখানোর জন্য একটি ইন্টারঅ্যাকটিভ ডেমো।</p></div><span className="demo-chip">শুধু ডেমো</span></div>
    <div className="demo-banner"><Icon name="shield" size={16}/><span>এগুলো চিকিৎসকের অনুমোদিত ব্যক্তিগত পরিকল্পনা নয়। কোনো ওষুধ বা চিকিৎসার নির্দেশ এখানে দেওয়া হচ্ছে না।</span></div>
    <div className="routine-layout"><article className="panel routine-list-panel"><div className="panel-header"><div><div className="section-kicker">নিজের জন্য নোট</div><h2>আজ যা করতে পারেন</h2></div><span className="routine-total">{bengali(done.length, 0)} / {bengali(routineItems.length, 0)}</span></div>{routineItems.map((item) => <label className={`routine-item ${done.includes(item.id) ? "completed" : ""}`} key={item.id}><input type="checkbox" checked={done.includes(item.id)} onChange={() => onToggle(item.id)}/><span className="routine-check"/><span className="routine-item-copy"><strong>{item.title}</strong><small>{item.detail}</small></span></label>)}<button className="primary-button" onClick={onOpenEntry}><Icon name="plus" size={17}/> রিডিং যোগ করুন</button></article>
      <aside className="panel routine-context"><div className="section-kicker">কীভাবে এটি পরে কাজ করতে পারে</div><h2>আপনার পরিকল্পনার সঙ্গে মিলিয়ে</h2><p>বাস্তব পণ্যে রোগীর পছন্দ ও চিকিৎসকের সঙ্গে ঠিক করা লক্ষ্য অনুযায়ী কাজগুলো সাজানো হবে। ঘড়ি থাকলে পদক্ষেপ বা ঘুমের সারাংশ ঐচ্ছিকভাবে যোগ হতে পারে।</p><div className="context-list"><span><Icon name="steps" size={17}/> পদক্ষেপ ও চলাফেরা</span><span><Icon name="moon" size={17}/> ঘুমের সময়</span><span><Icon name="heart" size={17}/> নির্ধারিত মাপের রিমাইন্ডার</span></div><div className="entry-source"><Icon name="shield" size={15}/> কোনো তথ্য ডিভাইস থেকে আসছে না। এই তালিকা রিফ্রেশে মুছে যাবে।</div></aside></div>
  </section>;
}

function LearningPage({ scenario, setScenario, day, setDay, metric, setMetric, series, analysis }: { scenario: DemoScenario; setScenario: (scenario: DemoScenario) => void; day: number; setDay: (day: number) => void; metric: DemoMetric; setMetric: (metric: DemoMetric) => void; series: ReturnType<typeof createDemoSeries>; analysis: ReturnType<typeof analyzeDemoSeries> }) {
  const scenarioOptions: { id: DemoScenario; title: string; description: string }[] = [
    { id: "steady", title: "স্থিতিশীল নমুনা", description: "ছোট স্বাভাবিক ওঠানামা" },
    { id: "gradual-change", title: "ধীরে পরিবর্তন", description: "কয়েকটি ধারার মান সরে যায়" },
    { id: "noisy", title: "অনিয়মিত মান", description: "ওঠানামা বেশি, স্থায়ী ধারা কম" },
    { id: "missing-data", title: "তথ্য অনুপস্থিত", description: "শেষের কিছু দিন মাপা হয়নি" },
  ];
  const metricOptions: { id: DemoMetric; title: string }[] = [
    { id: "glucose", title: "শর্করা" }, { id: "pressure", title: "রক্তচাপ" }, { id: "steps", title: "পদক্ষেপ" }, { id: "sleep", title: "ঘুম" }, { id: "resting-heart-rate", title: "হার্ট রেট" },
  ];
  return <section className="feature-page"><div className="welcome-row"><div><div className="eyebrow"><span className="status-dot"/> সিন্থেটিক শেখার ডেমো</div><h1>নিজের বেসলাইন কীভাবে তৈরি হয়</h1><p className="welcome-copy">একটি কৃত্রিম উদাহরণে রেফারেন্স সময়, সাম্প্রতিক মান এবং অনুপস্থিত তথ্য দেখুন।</p></div><span className="demo-chip">ক্লিনিক্যাল মডেল নয়</span></div>
    <div className="demo-banner"><Icon name="shield" size={16}/><span>সব মান তৈরি করা নমুনা। এখানে কোনো ব্যক্তির শরীর শেখা হচ্ছে না, কোনো রোগের পূর্বাভাসও দেওয়া হচ্ছে না।</span></div>
    <div className="learning-layout"><article className="panel learning-panel"><div className="panel-header"><div><div className="section-kicker">নমুনা পরিস্থিতি</div><h2>একটি ধারা বেছে নিন</h2></div><span className="learning-index">{bengali(day, 0)} / ২৮ দিন</span></div><div className="scenario-grid">{scenarioOptions.map((option) => <button key={option.id} className={`scenario-card ${scenario === option.id ? "selected" : ""}`} onClick={() => { setScenario(option.id); setDay(28); }}><strong>{option.title}</strong><span>{option.description}</span></button>)}</div><label className="timeline-control">ডেমো সময় এগিয়ে নিন<input type="range" min="5" max="28" value={day} onChange={(event) => setDay(Number(event.target.value))}/><span><span>শুরু</span><span>শেষ</span></span></label><div className="segmented metric-switch">{metricOptions.map((option) => <button key={option.id} className={metric === option.id ? "selected" : ""} onClick={() => setMetric(option.id)}>{option.title}</button>)}</div><div className="learning-chart-wrap"><DemoChart series={series} metric={metric}/><div className="chart-dates"><span>দিন ১</span><span>দিন ১৪ · বেসলাইন</span><span>দিন {bengali(day, 0)}</span></div><div className="chart-footnote"><span className="baseline-legend"/> প্রথম ১৪ দিনের নমুনা রেফারেন্স <span className="chart-source">ফাঁকা বিন্দু = তথ্য নেই</span></div></div></article>
      <aside className="panel learning-summary"><div className="section-kicker">ডেমো ইঞ্জিনের পাঠ</div><h2>{!analysis.ready ? "বেসলাইন এখনো তৈরি হয়নি" : analysis.shiftedSignals >= 2 ? "একাধিক নমুনা ধারায় পরিবর্তন" : analysis.shiftedSignals === 1 ? "একটি নমুনা ধারায় পরিবর্তন" : "নমুনা মান রেফারেন্সের কাছাকাছি"}</h2><p className="learning-explainer">{!analysis.ready ? "রেফারেন্স দেখানোর আগে ডেমোতে ১৪ দিনের তথ্য অপেক্ষা করা হচ্ছে।" : analysis.shiftedSignals >= 2 ? "নির্বাচিত নমুনায় একাধিক ধারার সাম্প্রতিক গড় প্রথম ১৪ দিনের নমুনা রেফারেন্স থেকে সরে গেছে।" : analysis.shiftedSignals === 1 ? "একটি ধারার সাম্প্রতিক গড় নমুনা রেফারেন্স থেকে সরে গেছে। একটি মাত্র পরিবর্তন থেকে সিদ্ধান্ত নেওয়া হয় না।" : "এই নমুনা পরিস্থিতিতে সাম্প্রতিক গড়গুলো প্রথম ১৪ দিনের রেফারেন্সের কাছাকাছি আছে।"}</p><div className="signal-list">{analysis.signals.map((signal) => <div className="signal-row" key={signal.metric}><span><strong>{signal.title}</strong><small>রেফারেন্স {signal.baseline === null ? "তৈরি হয়নি" : `${bengali(signal.baseline, 1)} ${signal.unit}`} · সাম্প্রতিক {signal.recent === null ? "তথ্য কম" : `${bengali(signal.recent, 1)} ${signal.unit}`}</small></span><span className={`signal-state ${signal.shifted ? "changed" : ""}`}>{!analysis.ready ? "শেখা চলছে" : signal.recent === null || signal.baseline === null ? "তথ্য কম" : signal.shifted ? "সরে গেছে" : "কাছাকাছি"}</span></div>)}</div><div className="entry-source"><Icon name="shield" size={15}/> ডেমোর নিয়মে প্রথম ১৪ দিন রেফারেন্স এবং পরের ৭ দিন তুলনা করা হয়। এই নিয়ম চিকিৎসাগতভাবে যাচাই করা নয়।</div></aside></div>
  </section>;
}

function ClinicianPage({ readings, averageGlucose, averageSystolic, averageDiastolic, sharePeriod, shareGlucose, sharePressure, onRevoke }: { readings: Reading[]; averageGlucose: number; averageSystolic: number; averageDiastolic: number; sharePeriod: string; shareGlucose: boolean; sharePressure: boolean; onRevoke: () => void }) {
  const records = sharePeriod === "week" ? readings.slice(-7) : readings;
  return <section className="feature-page"><div className="welcome-row"><div><div className="eyebrow"><span className="status-dot"/> সিমুলেটেড চিকিৎসক ভিউ</div><h1>রাফি আহমেদের স্বাস্থ্য সারাংশ</h1><p className="welcome-copy">রোগীর অনুমোদিত সীমার অনুকরণ · নমুনা প্রোফাইল</p></div><span className="demo-chip">বাস্তব শেয়ার নয়</span></div>
    <div className="demo-banner"><Icon name="shield" size={16}/><span>এই স্ক্রিনটি QR স্ক্যানের পর চিকিৎসক কী দেখতে পারেন তার নমুনা। কোনো চিকিৎসক সাইন-ইন করেননি এবং কোনো তথ্য পাঠানো হয়নি।</span></div>
    <div className="clinician-access"><div><span className="access-label">ডেমো টোকেন</span><strong>{sharePeriod === "all" ? "সব নমুনা ইতিহাস" : "শেষ ৭ দিনের নমুনা"}</strong></div><div><span className="access-label">অনুমোদিত বিভাগ</span><strong>{[shareGlucose && "রক্তে শর্করা", sharePressure && "রক্তচাপ"].filter(Boolean).join(" ও ") || "কোনো বিভাগ নেই"}</strong></div><button className="quiet-link" onClick={onRevoke}>ডেমো অ্যাক্সেস বন্ধ করুন</button></div>
    <section className="summary-grid clinician-metrics">{shareGlucose && <article className="metric-card"><div className="metric-top"><span className="metric-icon glucose-icon"><Icon name="drop" size={17}/></span><span className="metric-label">নমুনা গড় শর্করা</span></div><div className="metric-value">{bengali(averageGlucose)} <span>mmol/L</span></div><div className="metric-bottom">{bengali(records.length, 0)}টি নমুনা রেকর্ড</div></article>}{sharePressure && <article className="metric-card"><div className="metric-top"><span className="metric-icon pressure-icon"><Icon name="heart" size={17}/></span><span className="metric-label">নমুনা গড় রক্তচাপ</span></div><div className="metric-value">{bengali(averageSystolic)}/{bengali(averageDiastolic)} <span>mmHg</span></div><div className="metric-bottom">{bengali(records.length, 0)}টি নমুনা রেকর্ড</div></article>}</section>
    <article className="panel clinician-timeline"><div className="panel-header"><div><div className="section-kicker">নমুনা ইতিহাস</div><h2>রিডিংয়ের সময়রেখা</h2></div><span className="period-label">{sharePeriod === "all" ? "সব নমুনা দিন" : "শেষ ৭ দিন"}</span></div><div className="reading-table"><div className="table-head"><span>তারিখ ও সময়</span>{shareGlucose && <span>শর্করা</span>}{sharePressure && <span>রক্তচাপ</span>}<span>উৎস</span></div>{records.slice().reverse().map((reading) => <div className="reading-row" key={reading.id}><span className="reading-date"><strong>{reading.date}</strong><small>{reading.time}</small></span>{shareGlucose && <span>{bengali(mgdlToMmol(reading.glucoseMgDl))} <small>mmol/L</small></span>}{sharePressure && <span>{bengali(reading.systolic)}/{bengali(reading.diastolic)} <small>mmHg</small></span>}<span className="source-chip">{sourceName(reading.source)}</span></div>)}</div></article>
  </section>;
}

function ShifaPanel(props: {
  messages: ShifaMessage[];
  question: string;
  setQuestion: (value: string) => void;
  consent: boolean;
  setConsent: (value: boolean) => void;
  sending: boolean;
  error: string;
  contextLabel: string;
  onAsk: (question: string) => void;
  onAction: (action: ShifaAction) => void;
  onClose: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [props.messages, props.sending]);
  const suggestions = ["এই সময়ের রিডিং বুঝিয়ে বলুন", "আজকের অভ্যাস দেখান", "ডাক্তারের জন্য সারাংশ তৈরি করুন"];
  const actionLabels: Record<Exclude<ShifaAction, null>, string> = {
    open_routine: "দৈনিক অভ্যাস খুলুন",
    open_share: "সারাংশের সীমা বেছে নিন",
    open_entry: "রিডিং যোগ করুন",
    open_learning: "বেসলাইন ডেমো দেখুন",
  };

  return <div className="shifa-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <aside className="shifa-panel" role="dialog" aria-modal="true" aria-label="শিফা সহকারী">
      <header className="shifa-header"><div className="shifa-avatar"><Icon name="heartFilled" size={18}/></div><div className="shifa-identity"><strong>শিফা</strong><span>লাইফলুপের সহকারী</span></div><span className="shifa-mode">ডেমো</span><button className="modal-close" onClick={props.onClose} aria-label="বন্ধ করুন"><Icon name="close"/></button></header>
      <div className="shifa-context"><span className="status-dot"/> বর্তমান পাতা: {props.contextLabel} <span>নমুনা প্রোফাইল</span></div>
      <div className="shifa-messages" aria-live="polite">
        {props.messages.map((message) => <article className={`shifa-message ${message.role}`} key={message.id}>
          <div className="shifa-bubble">{message.text}</div>
          {message.role === "assistant" && <>{message.basis && <div className="shifa-evidence">তথ্যের ভিত্তি: {message.basis}</div>}{message.mode === "demo-fallback" && <div className="shifa-fallback-note">এআই সংযোগ নেই; সীমিত ডেমো নিয়মে উত্তর</div>}{message.action && <button className="shifa-action" onClick={() => props.onAction(message.action!)}>{actionLabels[message.action]} <Icon name="arrow" size={14}/></button>}</>}
        </article>)}
        {props.sending && <div className="shifa-thinking" role="status">শিফা ডেমো তথ্য মিলিয়ে দেখছে</div>}
        <div ref={endRef}/>
      </div>
      {props.messages.length <= 1 && <div className="shifa-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => props.onAsk(suggestion)}>{suggestion}</button>)}</div>}
      <form className="shifa-composer" onSubmit={(event) => { event.preventDefault(); props.onAsk(props.question); }}>
        <textarea value={props.question} onChange={(event) => props.setQuestion(event.target.value)} maxLength={500} rows={2} placeholder="বাংলায় লিখুন…" aria-label="শিফাকে প্রশ্ন লিখুন"/>
        {props.error && <p className="parse-feedback error" role="alert">{props.error}</p>}
        <label className="shifa-consent"><input type="checkbox" checked={props.consent} onChange={(event) => props.setConsent(event.target.checked)}/><span>আমার লেখা প্রশ্ন AI সেবায় পাঠানো হতে পারে। অ্যাপের রেকর্ডের তালিকা AI-তে পাঠানো হয় না।</span></label>
        <div className="shifa-compose-footer"><span>শিফা রোগ নির্ণয় বা চিকিৎসার পরামর্শ দেয় না</span><button type="submit" disabled={!props.question.trim() || !props.consent || props.sending}>পাঠান</button></div>
      </form>
    </aside>
  </div>;
}

function EntryModal(props: {
  entryMode: "manual" | "checkin"; setEntryMode: (mode: "manual" | "checkin") => void; glucose: string; setGlucose: (value: string) => void; systolic: string; setSystolic: (value: string) => void; diastolic: string; setDiastolic: (value: string) => void; glucoseUnit: GlucoseUnit | ""; setGlucoseUnit: (value: GlucoseUnit | "") => void;
  checkinText: string; setCheckinText: (value: string) => void; aiConsent: boolean; setAiConsent: (value: boolean) => void; isParsing: boolean; parseError: string; entryError: string; draftNeedsReview: boolean; setDraftNeedsReview: (value: boolean) => void; reviewConfirmed: boolean; setReviewConfirmed: (value: boolean) => void;
  onParse: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void; onOpenPhoto: () => void;
}) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
    <div className="modal-head"><div><div className="section-kicker">শুধু ডেমো রেকর্ড</div><h2 id="entry-title">নতুন রিডিং যোগ করুন</h2></div><button className="modal-close" onClick={props.onClose} aria-label="বন্ধ করুন"><Icon name="close"/></button></div>
    <p className="modal-intro">রিডিং লিখুন অথবা বাংলায় ছোট করে বলুন। সংরক্ষণের আগে প্রতিটি মান যাচাই করুন।</p>
    <button className="photo-import-link" type="button" onClick={props.onOpenPhoto}>ডায়েরির ছবি থেকে খসড়া তৈরি করুন <Icon name="arrow" size={14}/></button>
    <div className="entry-tabs"><button className={props.entryMode === "manual" ? "selected" : ""} onClick={() => { if (props.draftNeedsReview) { props.setGlucose(""); props.setSystolic(""); props.setDiastolic(""); } props.setEntryMode("manual"); props.setReviewConfirmed(false); }}>নিজে লিখুন</button><button className={props.entryMode === "checkin" ? "selected" : ""} onClick={() => props.setEntryMode("checkin")}>বাংলায় লিখুন</button></div>
    {props.entryMode === "checkin" && <div className="checkin-panel"><label className="checkin-label" htmlFor="checkin-text">আপনার রিডিংটি লিখুন</label><textarea id="checkin-text" maxLength={700} value={props.checkinText} onChange={(event) => { props.setCheckinText(event.target.value); if (props.draftNeedsReview) { props.setDraftNeedsReview(false); props.setGlucose(""); props.setSystolic(""); props.setDiastolic(""); props.setGlucoseUnit(""); props.setReviewConfirmed(false); } }} placeholder="যেমন: আজ সকালে শর্করা ৭.২ mmol/L, প্রেসার ১৩২ বাই ৮৪"/><p className="privacy-copy">এআই খসড়া তৈরির জন্য লেখাটি AI সেবায় পাঠানো হবে। পরিচয় বোঝায় এমন তথ্য লিখবেন না।</p><label className="consent-row"><input type="checkbox" checked={props.aiConsent} onChange={(event) => props.setAiConsent(event.target.checked)}/><span>আমি বুঝেছি, আমার লেখা AI দিয়ে খসড়া তৈরির জন্য পাঠানো হবে।</span></label><button className="secondary-button" type="button" disabled={!props.checkinText.trim() || !props.aiConsent || props.isParsing} onClick={props.onParse}>{props.isParsing ? "তথ্য যাচাই হচ্ছে" : "রিডিংয়ের খসড়া তৈরি করুন"}</button>{props.parseError && <p className={`parse-feedback ${props.draftNeedsReview ? "notice" : "error"}`} role="status">{props.parseError}</p>}</div>}
    {(props.entryMode === "manual" || props.draftNeedsReview) && <form className="reading-form" onSubmit={props.onSave}>{props.draftNeedsReview && <div className="draft-banner"><Icon name="shield" size={16}/><span>এআই থেকে পাওয়া খসড়া। মূল রিডিংয়ের সঙ্গে প্রতিটি ঘর মিলিয়ে দেখুন।</span></div>}<label>রক্তে শর্করা <select value={props.glucoseUnit} onChange={(event) => { props.setGlucoseUnit(event.target.value as GlucoseUnit | ""); if (props.draftNeedsReview) props.setReviewConfirmed(false); }} required><option value="">একক বাছুন</option><option value="mmol/L">mmol/L</option><option value="mg/dL">mg/dL</option></select><input type="text" inputMode="decimal" placeholder="যেমন ৭.২" value={props.glucose} onChange={(event) => { props.setGlucose(event.target.value); if (props.draftNeedsReview) props.setReviewConfirmed(false); }} required/></label><div className="form-pair"><label>সিস্টোলিক চাপ <span>mmHg</span><input type="text" inputMode="decimal" placeholder="যেমন ১৩২" value={props.systolic} onChange={(event) => { props.setSystolic(event.target.value); if (props.draftNeedsReview) props.setReviewConfirmed(false); }} required/></label><label>ডায়াস্টোলিক চাপ <span>mmHg</span><input type="text" inputMode="decimal" placeholder="যেমন ৮৪" value={props.diastolic} onChange={(event) => { props.setDiastolic(event.target.value); if (props.draftNeedsReview) props.setReviewConfirmed(false); }} required/></label></div>{props.entryError && <p className="parse-feedback error" role="alert">{props.entryError}</p>}{props.draftNeedsReview && <label className="review-confirm"><input type="checkbox" checked={props.reviewConfirmed} onChange={(event) => props.setReviewConfirmed(event.target.checked)} required/><span>আমি প্রতিটি মান ও একক মিলিয়ে দেখেছি।</span></label>}<div className="entry-source"><Icon name="shield" size={15}/>নতুন রেকর্ড শুধু এই ডেমো সেশনে থাকবে।</div><button className="primary-button modal-submit" type="submit" disabled={props.draftNeedsReview && !props.reviewConfirmed}>ডেমো রিডিং যোগ করুন</button></form>}
  </section></div>;
}

function ShareModal(props: { step: ShareStep; period: string; setPeriod: (value: string) => void; glucose: boolean; setGlucose: (value: boolean) => void; pressure: boolean; setPressure: (value: boolean) => void; token: string; error: string; onCreate: () => void; onSimulateScan: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}><section className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="modal-head"><div><div className="section-kicker">সিমুলেটেড শেয়ার প্রবাহ</div><h2 id="share-title">ডাক্তারের সঙ্গে ভাগ</h2></div><button className="modal-close" onClick={props.onClose} aria-label="বন্ধ করুন"><Icon name="close"/></button></div>
    {props.step === "choose" ? <><p className="modal-intro">বাস্তব পণ্যে QR শুধু অনুমতি চাওয়ার নিরাপদ উপায় হবে। এই ডেমোতে কোনো তথ্য পাঠানো হয় না।</p><label className="share-field">কোন সময়ের তথ্য দেখাবেন<select value={props.period} onChange={(event) => props.setPeriod(event.target.value)}><option value="week">শেষ ৭ দিনের নমুনা</option><option value="all">সব নমুনা ইতিহাস</option></select></label><div className="share-scopes"><span>কোন তথ্য দেখাবেন</span><label><input type="checkbox" checked={props.glucose} onChange={(event) => props.setGlucose(event.target.checked)}/> রক্তে শর্করা</label><label><input type="checkbox" checked={props.pressure} onChange={(event) => props.setPressure(event.target.checked)}/> রক্তচাপ</label></div><div className="entry-source"><Icon name="shield" size={15}/> ডেমো QR-এ স্বাস্থ্যতথ্য বা আসল অ্যাকাউন্ট থাকে না।</div>{props.error && <p className="parse-feedback error" role="alert">{props.error}</p>}<button className="primary-button modal-submit" onClick={props.onCreate} disabled={!props.glucose && !props.pressure}>ডেমো QR তৈরি করুন</button></> : <><div className="qr-demo-wrap"><DemoQr token={props.token}/><div><span className="demo-chip">স্ক্যানযোগ্য নয়</span><h3>ডেমো অনুরোধ তৈরি হয়েছে</h3><p>টোকেন: <strong>{props.token}</strong></p><small>আসল QR নয়। বাস্তব অ্যাকাউন্ট বা তথ্যের সঙ্গে যুক্ত নয়।</small></div></div>{props.error && <p className="parse-feedback error" role="alert">{props.error}</p>}<button className="primary-button modal-submit" onClick={props.onSimulateScan}>ডাক্তারের স্ক্যান অনুকরণ করুন</button><button className="text-link modal-back" onClick={props.onClose}>বন্ধ করুন</button></>}
  </section></div>;
}
