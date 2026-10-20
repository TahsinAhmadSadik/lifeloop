"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeDemoSeries,
  createDemoSeries,
  demoMetricValue,
  type DemoMetric,
  type DemoScenario,
} from "@/lib/demo-health";
import {
  demoShareStorageKey,
  rafiDemoReadings,
  type DemoSharePayload,
} from "@/lib/demo-patients";
import {
  glucoseToMgdl,
  mgdlToMmol,
  parseLocalizedNumber,
  type GlucoseUnit,
} from "@/lib/health";

type Reading = {
  id: number;
  date: string;
  glucoseMgDl: number;
  systolic: number;
  diastolic: number;
  time: string;
  source: "sample" | "manual-demo" | "ai-draft-demo";
};
type View = "overview" | "routine" | "learning" | "clinician";
type ShareStep = "choose" | "qr";
type ShifaAction =
  | "open_routine"
  | "open_share"
  | "open_entry"
  | "open_learning"
  | null;
type ShifaMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  basis?: string;
  mode?: "ai" | "demo-fallback";
  action?: ShifaAction;
};

const initialReadings: Reading[] = rafiDemoReadings.map((reading) => ({
  ...reading,
  glucoseMgDl: reading.glucoseMgDl ?? 0,
  systolic: reading.systolic ?? 0,
  diastolic: reading.diastolic ?? 0,
}));

// Comprehensive bilingual dictionary
const t = {
  bn: {
    brandName: "লাইফলুপ",
    workspaceLabel: "ডেমো স্বাস্থ্য অ্যাপ",
    sidebarNote:
      "সব রেকর্ড নমুনা বা এই ডেমোতে লেখা। কোনো বাস্তব ক্লিনিকে পাঠানো হয় না।",
    profileName: "রাফি আহমেদ",
    profileRole: "নমুনা প্রোফাইল",
    avatar: "রা",
    navOverview: "সারাংশ",
    navRoutine: "দৈনিক অভ্যাস",
    navLearning: "বেসলাইন ডেমো",
    navShare: "ডাক্তারের সঙ্গে ভাগ",
    clinicianTab: "ডাক্তার",
    topbarPrefix: "লাইফলুপ ডেমো",
    welcomeEyebrow: "নমুনা স্বাস্থ্য প্রোফাইল",
    welcomeTitle: "সুপ্রভাত, রাফি",
    welcomeCopy:
      "এই ডেমোতে নিজের রিডিং দেখুন, অভ্যাস নোট করুন এবং শেয়ার প্রবাহটি ঘুরে দেখুন।",
    datePill: "১২ থেকে ১৮ অক্টোবর, ২০২৬",
    demoBanner:
      "নমুনা তথ্য দিয়ে তৈরি প্রোটোটাইপ। কোনো বাস্তব ডিভাইস, চিকিৎসক বা স্বাস্থ্য রেকর্ডের সঙ্গে সংযুক্ত নয়।",
    bloodSugar: "রক্তে শর্করা",
    bloodPressure: "রক্তচাপ",
    sampleComparison: "নমুনা তথ্যের তুলনা",
    readingsSuffix: "টি রিডিং",
    latest: "সর্বশেষ",
    fromFirst: "প্রথম রিডিং থেকে",
    higher: "বেশি",
    lower: "কম",
    viewBaselineLink: "বেসলাইন ডেমো দেখুন",
    trendKicker: "নমুনা রিডিং",
    trendTitle: "সময়ের সঙ্গে পরিবর্তন",
    glucoseTab: "শর্করা",
    pressureTab: "রক্তচাপ",
    systolicBP: "সিস্টোলিক রক্তচাপ",
    weeklyAvg: "সাপ্তাহিক গড়",
    demoRecord: "ডেমো রেকর্ড",
    demoRecordFootnote: "উদাহরণ, ব্যক্তিগত স্বাস্থ্য বিশ্লেষণ নয়",
    insightKicker: "সরল তুলনা",
    insightTitle: "এই কার্ড কী দেখায়",
    insightFoot:
      "এটি শুধু নমুনা ডেটার তুলনা। কোনো বেসলাইন, রোগ নির্ণয় বা ভবিষ্যদ্বাণী নয়।",
    demoDoctorLink: "ডাক্তারের ভিউ ডেমো করুন",
    recentKicker: "সাম্প্রতিক নমুনা",
    recentTitle: "রিডিংয়ের তালিকা",
    baselineTest: "বেসলাইন পরীক্ষা",
    colDateTime: "তারিখ ও সময়",
    colGlucose: "শর্করা",
    colPressure: "রক্তচাপ",
    colType: "তথ্যের ধরন",
    routineKicker: "দৈনিক অভ্যাস",
    routineTitle: "আজকের ডেমো অগ্রগতি",
    habitsLogged: "টি অভ্যাস চিহ্নিত",
    routineNote: "নমুনা কাজগুলো শুধু ইন্টারফেস দেখানোর জন্য।",
    openHabits: "অভ্যাস খুলুন",
    sessionNote: "নতুন রিডিং শুধু এই ডেমো সেশনে থাকে",
    addReading: "রিডিং যোগ করুন",
    disclaimer:
      "লাইফলুপ প্রোটোটাইপ · সব নমুনা তথ্য কাল্পনিক · কোনো বাস্তব ডিভাইস, চিকিৎসক বা স্বাস্থ্য রেকর্ড সংযুক্ত নয়",
    shifaName: "শিফা",
    shifaGreeting:
      "আমি শিফা, লাইফলুপের সহকারী। দেখানো নমুনা রিডিং বুঝতে, ডেমো রুটিন দেখতে বা ডাক্তার-সারাংশের খসড়া খুলতে সাহায্য করতে পারি। আমি রোগ নির্ণয় বা চিকিৎসার পরামর্শ দিই না।",
  },
  en: {
    brandName: "LifeLoop",
    workspaceLabel: "Demo Health App",
    sidebarNote:
      "All records are sample or demo entries. Not sent to any clinic.",
    profileName: "Rafi Ahmed",
    profileRole: "Sample Profile",
    avatar: "RA",
    navOverview: "Overview",
    navRoutine: "Daily Habits",
    navLearning: "Baseline Demo",
    navShare: "Share with Doctor",
    clinicianTab: "Doctor",
    topbarPrefix: "LifeLoop Demo",
    welcomeEyebrow: "Sample Health Profile",
    welcomeTitle: "Good Morning, Rafi",
    welcomeCopy:
      "Track your readings, log habits, and explore the clinical sharing flow in this demo.",
    datePill: "Oct 12 – 18, 2026",
    demoBanner:
      "Prototype built with sample data. Not connected to real devices, physicians, or medical records.",
    bloodSugar: "Blood Glucose",
    bloodPressure: "Blood Pressure",
    sampleComparison: "Sample Comparison",
    readingsSuffix: "readings",
    latest: "Latest",
    fromFirst: "from first reading",
    higher: "higher",
    lower: "lower",
    viewBaselineLink: "View Baseline Demo",
    trendKicker: "Sample Readings",
    trendTitle: "Trends Over Time",
    glucoseTab: "Glucose",
    pressureTab: "Blood Pressure",
    systolicBP: "Systolic Blood Pressure",
    weeklyAvg: "Weekly Avg",
    demoRecord: "Demo Record",
    demoRecordFootnote: "Example, not personal health analysis",
    insightKicker: "Simple Comparison",
    insightTitle: "What This Card Shows",
    insightFoot:
      "This is only a sample comparison. Not a baseline, diagnosis, or prediction.",
    demoDoctorLink: "Demo Doctor's View",
    recentKicker: "Recent Samples",
    recentTitle: "Reading List",
    baselineTest: "Test Baseline",
    colDateTime: "Date & Time",
    colGlucose: "Glucose",
    colPressure: "Blood Pressure",
    colType: "Data Type",
    routineKicker: "Daily Habits",
    routineTitle: "Today's Demo Progress",
    habitsLogged: "habits logged",
    routineNote: "Sample tasks for UI demonstration only.",
    openHabits: "Open Habits",
    sessionNote: "New readings stay in this demo session only",
    addReading: "Add Reading",
    disclaimer:
      "LifeLoop Prototype · All sample data synthetic · Not connected to real devices, physicians, or medical records",
    shifaName: "Shifa",
    shifaGreeting:
      "I am Shifa, LifeLoop's assistant. I can help explain sample readings, view demo routines, or prepare a doctor's summary draft. I do not diagnose or prescribe treatment.",
  },
};

const routineItemsBn = [
  { id: "measure", title: "আজকের রিডিং লিখেছি", detail: "আপনার নির্ধারিত মাপার সময় অনুযায়ী" },
  { id: "movement", title: "আজকের চলাফেরা নোট করেছি", detail: "পদক্ষেপ বা নিজের ছোট নোট" },
  { id: "meal", title: "খাবারের একটি নোট রেখেছি", detail: "ঐচ্ছিক, কোনো পুষ্টি-স্কোর নয়" },
  { id: "sleep", title: "ঘুমের সময় লিখেছি", detail: "ডিভাইস থাকলে আনুমানিক তথ্য" },
];

const routineItemsEn = [
  { id: "measure", title: "Logged today's reading", detail: "Based on scheduled measurement time" },
  { id: "movement", title: "Logged daily activity", detail: "Steps or personal activity notes" },
  { id: "meal", title: "Logged a meal note", detail: "Optional, not a nutrition score" },
  { id: "sleep", title: "Logged sleep duration", detail: "Estimated data if device available" },
];

// Helper: formats dates cleanly between Bengali and English
function formatDate(dateStr: string, currentLang: "bn" | "en") {
  if (currentLang === "bn") return dateStr;
  const bnToEnDigits: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  let en = dateStr.replace(/[০-৯]/g, (d) => bnToEnDigits[d] || d);
  return en.replace(/অক্টোবর/g, "Oct").replace(/অক্টো/g, "Oct");
}

// Helper: formats times cleanly between Bengali and English
function formatTime(timeStr: string, currentLang: "bn" | "en") {
  if (currentLang === "bn") return timeStr;
  const bnToEnDigits: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  let en = timeStr.replace(/[০-৯]/g, (d) => bnToEnDigits[d] || d);
  if (en.includes("সকাল")) return en.replace("সকাল", "").trim() + " AM";
  if (en.includes("দুপুর") || en.includes("সন্ধ্যা") || en.includes("রাত")) {
    return en.replace(/দুপুর|সন্ধ্যা|রাত/, "").trim() + " PM";
  }
  return en;
}

function sourceName(source: Reading["source"], currentLang: "bn" | "en") {
  if (currentLang === "en") {
    if (source === "sample") return "Sample Data";
    if (source === "ai-draft-demo") return "AI Draft Verified";
    return "Demo Entry";
  }
  if (source === "sample") return "নমুনা তথ্য";
  if (source === "ai-draft-demo") return "এআই খসড়া যাচাই";
  return "ডেমোতে লেখা";
}

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 4-4 3 2 6-7" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v3H9zM8 11h8M8 15h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    heart: (
      <>
        <path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />
        <path d="M3.5 12h4l2-3 3 6 2-3h6" />
      </>
    ),
    heartFilled: (
      <path
        d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"
        fill="currentColor"
        stroke="none"
      />
    ),
    drop: (
      <>
        <path d="M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z" />
        <path d="M9 16a3 3 0 0 0 3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
    moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />,
    steps: (
      <>
        <path d="M7 20c-2 0-3-1.5-2-3.5l2-4c1-2 3-1.5 3.5.5l1 4C12 19 10 20 7 20ZM16 14c-1.5 0-2.3-1.1-1.7-2.6l1.2-2.5c.7-1.3 2-1 2.4.3l.7 2.5c.4 1.4-.9 2.3-2.6 2.3Z" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
      </>
    ),
    chat: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" />
        <path d="M8 11h8M8 14h5" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.chart}</svg>;
}

function TrendChart({
  readings,
  metric,
}: {
  readings: Reading[];
  metric: "glucose" | "pressure";
}) {
  const values = readings
    .slice(-7)
    .map((reading) =>
      metric === "glucose" ? mgdlToMmol(reading.glucoseMgDl) : reading.systolic
    );
  const min = Math.min(...values) - (metric === "glucose" ? 0.6 : 9);
  const max = Math.max(...values) + (metric === "glucose" ? 0.6 : 9);
  const x = (index: number) =>
    30 + index * (540 / Math.max(values.length - 1, 1));
  const y = (value: number) => 150 - ((value - min) / (max - min)) * 118;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `30,150 ${points} ${x(values.length - 1)},150`;
  return (
    <svg
      className="trend-chart"
      viewBox="0 0 600 180"
      role="img"
      aria-label="Trend chart"
    >
      <defs>
        <linearGradient id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#397b60" stopOpacity=".13" />
          <stop offset="100%" stopColor="#397b60" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[32, 71, 110, 149].map((line) => (
        <line key={line} x1="30" y1={line} x2="570" y2={line} stroke="#edf0eb" />
      ))}
      <polygon points={area} fill={`url(#fill-${metric})`} />
      <polyline
        points={points}
        fill="none"
        stroke="#397b60"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => (
        <circle
          key={index}
          cx={x(index)}
          cy={y(value)}
          r="3.5"
          fill="#fff"
          stroke="#397b60"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function DemoChart({
  series,
  metric,
}: {
  series: ReturnType<typeof createDemoSeries>;
  metric: DemoMetric;
}) {
  const values = series.map((day) => demoMetricValue(day, metric));
  const baseline = values.slice(0, 14).filter((value): value is number => value !== null);
  const present = values.filter((value): value is number => value !== null);
  const median = (numbers: number[]) => {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const center = baseline.length ? median(baseline) : 0;
  const mad = baseline.length
    ? median(baseline.map((value) => Math.abs(value - center)))
    : 0;
  const padding = metric === "glucose" ? 0.5 : metric === "steps" ? 1000 : 5;
  const min = Math.min(...present, center - mad * 2) - padding;
  const max = Math.max(...present, center + mad * 2) + padding;
  const x = (index: number) =>
    28 + index * (544 / Math.max(values.length - 1, 1));
  const y = (value: number) =>
    150 - ((value - min) / Math.max(max - min, 1)) * 118;
  const points = values
    .map((value, index) => (value === null ? "" : `${x(index)},${y(value)}`))
    .filter(Boolean)
    .join(" ");
  const upper = y(center + Math.max(mad, padding * 0.3));
  const lower = y(center - Math.max(mad, padding * 0.3));
  return (
    <svg className="demo-chart" viewBox="0 0 600 180" role="img" aria-label="Demo baseline chart">
      {[32, 71, 110, 149].map((line) => (
        <line key={line} x1="28" y1={line} x2="572" y2={line} stroke="#edf0eb" />
      ))}
      {baseline.length >= 10 && (
        <rect
          x="28"
          y={Math.min(upper, lower)}
          width="544"
          height={Math.max(2, Math.abs(lower - upper))}
          fill="#e9f1e8"
        />
      )}
      {baseline.length >= 10 && (
        <line
          x1="28"
          y1={y(center)}
          x2="572"
          y2={y(center)}
          stroke="#78927c"
          strokeWidth="1.5"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="#397b60"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) =>
        value === null ? (
          <circle key={index} cx={x(index)} cy="165" r="2" fill="#c5cbc2" />
        ) : (
          <circle
            key={index}
            cx={x(index)}
            cy={y(value)}
            r="3"
            fill="#fff"
            stroke="#397b60"
            strokeWidth="2"
          />
        )
      )}
    </svg>
  );
}

function DemoQr({ token }: { token: string }) {
  const size = 25;
  const seed = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const inFinder =
      (row < 7 && column < 7) ||
      (row < 7 && column >= size - 7) ||
      (row >= size - 7 && column < 7);
    if (inFinder) {
      const localRow = row < 7 ? row : row - (size - 7);
      const localColumn = column < 7 ? column : column - (size - 7);
      return (
        localRow === 0 ||
        localRow === 6 ||
        localColumn === 0 ||
        localColumn === 6 ||
        (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4)
      );
    }
    return (row * 17 + column * 11 + seed + ((row * column) % 13)) % 3 !== 0;
  });
  return (
    <svg className="fake-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Demo QR">
      <rect width={size} height={size} fill="#fff" />
      {cells.map(
        (filled, index) =>
          filled && (
            <rect
              key={index}
              x={index % size}
              y={Math.floor(index / size)}
              width="1"
              height="1"
              fill="#263b31"
            />
          )
      )}
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<"bn" | "en">("bn");
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
  const [shifaMessages, setShifaMessages] = useState<ShifaMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t[lang].shifaGreeting,
    },
  ]);

  // Sync initial greeting when language changes
  useEffect(() => {
    setShifaMessages((prev) =>
      prev.map((msg) =>
        msg.id === "welcome" ? { ...msg, text: t[lang].shifaGreeting } : msg
      )
    );
  }, [lang]);

  // Unified number formatter that strictly follows active language
  const fmt = (value: number, digits = 1) =>
    new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", {
      maximumFractionDigits: digits,
    }).format(value);

  const latest = readings[readings.length - 1];
  const averageGlucose = useMemo(
    () =>
      mgdlToMmol(
        readings.reduce((sum, item) => sum + item.glucoseMgDl, 0) / readings.length
      ),
    [readings]
  );
  const averageSystolic = useMemo(
    () =>
      readings.reduce((sum, item) => sum + item.systolic, 0) / readings.length,
    [readings]
  );
  const averageDiastolic = useMemo(
    () =>
      readings.reduce((sum, item) => sum + item.diastolic, 0) / readings.length,
    [readings]
  );
  const glucoseChange = mgdlToMmol(latest.glucoseMgDl - readings[0].glucoseMgDl);
  const pressureChange = latest.systolic - readings[0].systolic;
  const midpoint = Math.floor(readings.length / 2);
  const firstPeriod = readings.slice(0, midpoint);
  const secondPeriod = readings.slice(midpoint);
  const glucoseDelta = mgdlToMmol(
    secondPeriod.reduce((sum, item) => sum + item.glucoseMgDl, 0) /
      secondPeriod.length -
      firstPeriod.reduce((sum, item) => sum + item.glucoseMgDl, 0) /
        firstPeriod.length
  );
  const pressureDelta =
    secondPeriod.reduce((sum, item) => sum + item.systolic, 0) /
      secondPeriod.length -
    firstPeriod.reduce((sum, item) => sum + item.systolic, 0) / firstPeriod.length;

  const patternTitle =
    lang === "bn"
      ? glucoseDelta >= 0 && pressureDelta >= 0
        ? "দুই মানই পরের সময়ে বেশি"
        : glucoseDelta <= 0 && pressureDelta <= 0
        ? "দুই মানই পরের সময়ে কম"
        : "দুই মানের পরিবর্তন একরকম নয়"
      : glucoseDelta >= 0 && pressureDelta >= 0
      ? "Both values higher in recent period"
      : glucoseDelta <= 0 && pressureDelta <= 0
      ? "Both values lower in recent period"
      : "Metrics drifting in different directions";

  const explanation =
    readings.length < 5
      ? lang === "bn"
        ? "এই নমুনা প্রবণতা দেখানোর জন্য আরও কিছু তথ্য প্রয়োজন। এটি কোনো রোগ নির্ণয় নয়।"
        : "More data required to assess this sample trend. This is not a diagnosis."
      : lang === "bn"
      ? `নমুনা তথ্যের দুই সময়পর্বের তুলনায় রক্তে শর্করা ${fmt(Math.abs(glucoseDelta))} mmol/L ${
          glucoseDelta >= 0 ? "বেশি" : "কম"
        } এবং সিস্টোলিক রক্তচাপ ${fmt(Math.abs(pressureDelta))} mmHg ${
          pressureDelta >= 0 ? "বেশি" : "কম"
        }। এটি একটি সরল ডেমো তুলনা, ব্যক্তিগত বেসলাইন বা চিকিৎসা-সংক্রান্ত সিদ্ধান্ত নয়।`
      : `Compared across sample periods, blood glucose is ${fmt(Math.abs(glucoseDelta))} mmol/L ${
          glucoseDelta >= 0 ? "higher" : "lower"
        } and systolic blood pressure is ${fmt(Math.abs(pressureDelta))} mmHg ${
          pressureDelta >= 0 ? "higher" : "lower"
        }. This is a simple demo comparison, not a personal baseline or clinical decision.`;

  const demoSeries = useMemo(
    () => createDemoSeries(demoScenario).slice(0, demoDay),
    [demoScenario, demoDay]
  );
  const demoAnalysis = useMemo(
    () => analyzeDemoSeries(demoSeries),
    [demoSeries]
  );
  const checkedCount = routineDone.length;
  const currentRoutineItems = lang === "bn" ? routineItemsBn : routineItemsEn;

  const viewLabels: Record<View, string> = {
    overview: t[lang].navOverview,
    routine: t[lang].navRoutine,
    learning: t[lang].navLearning,
    clinician: t[lang].clinicianTab,
  };

  const navItems: { view: View; title: string; icon: string }[] = [
    { view: "overview", title: t[lang].navOverview, icon: "home" },
    { view: "routine", title: t[lang].navRoutine, icon: "clipboard" },
    { view: "learning", title: t[lang].navLearning, icon: "chart" },
  ];

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
    const selectedRecords = (
      sharePeriod === "week" ? readings.slice(-7) : readings
    ).map((reading) => ({
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
      setShareError(
        lang === "bn"
          ? "এই ব্রাউজারে ডেমো সেশন তৈরি করা যায়নি। আবার চেষ্টা করুন।"
          : "Could not create demo session in this browser. Please try again."
      );
    }
  }

  function saveReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const glucoseValue = parseLocalizedNumber(glucose);
    const systolicValue = parseLocalizedNumber(systolic);
    const diastolicValue = parseLocalizedNumber(diastolic);
    if (
      glucoseValue === null ||
      systolicValue === null ||
      diastolicValue === null ||
      glucoseValue <= 0 ||
      systolicValue <= 0 ||
      diastolicValue <= 0
    ) {
      setEntryError(
        lang === "bn"
          ? "প্রতিটি ঘরে সঠিক ধনাত্মক সংখ্যা লিখুন। বাংলা বা ইংরেজি অঙ্ক ব্যবহার করা যাবে।"
          : "Please enter valid positive numbers in all fields."
      );
      return;
    }
    if (draftNeedsReview && !reviewConfirmed) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
      day: "numeric",
      month: "short",
    }).format(now);
    const time = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);

    setReadings((current) => [
      ...current,
      {
        id: Date.now(),
        date,
        time,
        glucoseMgDl: glucoseToMgdl(glucoseValue, glucoseUnit || "mmol/L"),
        systolic: systolicValue,
        diastolic: diastolicValue,
        source: draftNeedsReview ? "ai-draft-demo" : "manual-demo",
      },
    ]);
    setGlucose("");
    setSystolic("");
    setDiastolic("");
    setCheckinText("");
    setShowEntry(false);
    setDraftNeedsReview(false);
    setReviewConfirmed(false);
    setAiConsent(false);
    setEntryMode("manual");
    setEntryError("");
  }

  async function parseCheckin() {
    setGlucose("");
    setSystolic("");
    setDiastolic("");
    setGlucoseUnit("");
    setDraftNeedsReview(false);
    setReviewConfirmed(false);
    setEntryError("");
    setIsParsing(true);
    setParseError("");
    try {
      const response = await fetch("/api/checkin/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: checkinText }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error ||
            (lang === "bn"
              ? "রিডিং তৈরি করা যায়নি। হাতে লিখে দিন।"
              : "Could not parse reading. Please enter manually.")
        );
      const draft = payload.draft as {
        glucose: number | null;
        glucoseUnit: GlucoseUnit | "unknown";
        systolic: number | null;
        diastolic: number | null;
        needsClarification: boolean;
      };
      setGlucose(draft.glucose === null ? "" : String(draft.glucose));
      setGlucoseUnit(draft.glucoseUnit === "unknown" ? "" : draft.glucoseUnit);
      setSystolic(draft.systolic === null ? "" : String(draft.systolic));
      setDiastolic(draft.diastolic === null ? "" : String(draft.diastolic));
      setDraftNeedsReview(true);
      setReviewConfirmed(false);
      if (draft.needsClarification)
        setParseError(
          lang === "bn"
            ? "কিছু তথ্য অস্পষ্ট বা অনুপস্থিত। খালি ঘরগুলো নিজে পূরণ করুন এবং মূল রিডিংয়ের সঙ্গে মিলিয়ে নিন।"
            : "Some fields are unclear. Please review and fill manually."
        );
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : lang === "bn"
          ? "রিডিং তৈরি করা যায়নি। হাতে লিখে দিন।"
          : "Could not parse reading."
      );
      setDraftNeedsReview(false);
    } finally {
      setIsParsing(false);
    }
  }

  function openEntry() {
    setGlucose("");
    setSystolic("");
    setDiastolic("");
    setCheckinText("");
    setGlucoseUnit("mmol/L");
    setEntryMode("manual");
    setDraftNeedsReview(false);
    setReviewConfirmed(false);
    setAiConsent(false);
    setParseError("");
    setEntryError("");
    setShowEntry(true);
  }

  async function askShifa(question: string) {
    if (!shifaConsent) {
      setShifaError(
        lang === "bn"
          ? "শিফাকে প্রশ্ন পাঠানোর আগে সম্মতি দিন।"
          : "Please give consent before sending question to Shifa."
      );
      return;
    }
    const trimmed = question.trim();
    if (!trimmed || shifaSending) return;
    setShifaMessages((messages) => [
      ...messages,
      { id: `user-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setShifaQuestion("");
    setShifaError("");
    setShifaSending(true);
    try {
      const response = await fetch("/api/shifa/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          readings: readings.map(
            ({ glucoseMgDl, systolic, diastolic, date, time }) => ({
              glucoseMgDl,
              systolic,
              diastolic,
              date,
              time,
            })
          ),
          routineDone: routineDone.length,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        answer?: string;
        basis?: string;
        action?: ShifaAction;
        mode?: "ai" | "demo-fallback";
      };
      if (!response.ok || !result.answer)
        throw new Error(result.error || "Could not reach assistant.");
      setShifaMessages((messages) => [
        ...messages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result.answer!,
          basis: result.basis,
          action: result.action ?? null,
          mode: result.mode,
        },
      ]);
    } catch (error) {
      setShifaError(
        error instanceof Error
          ? error.message
          : lang === "bn"
          ? "শিফা এখন উত্তর দিতে পারছে না।"
          : "Shifa cannot respond right now."
      );
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

  return (
    <div className="app-shell" lang={lang}>
      {/* Sidebar */}
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => setView("overview")}
          aria-label={t[lang].brandName}
        >
          <span className="brand-mark">
            <Icon name="heart" size={19} />
          </span>
          <span className="brand-name">{t[lang].brandName}</span>
        </a>
        <div className="workspace-label">{t[lang].workspaceLabel}</div>
        <nav className="nav-list" aria-label="Main Navigation">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => setView(item.view)}
            >
              <Icon name={item.icon} />
              {item.title}
            </button>
          ))}
          <button
            className={`nav-item ${view === "clinician" ? "active" : ""}`}
            onClick={openShare}
          >
            <Icon name="share" />
            {t[lang].navShare}
          </button>
        </nav>
        <div className="sidebar-note">
          <Icon name="shield" size={16} />
          <p>{t[lang].sidebarNote}</p>
        </div>
        <div className="sidebar-profile">
          <div className="avatar">{t[lang].avatar}</div>
          <div>
            <strong>{t[lang].profileName}</strong>
            <span>{t[lang].profileRole}</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area" id="overview">
        {/* Topbar with Responsive Green Language Toggle */}
        <header className="topbar">
          <div className="breadcrumb">
            {t[lang].topbarPrefix} <span>/</span>{" "}
            <strong>{viewLabels[view]}</strong>
          </div>

          <div className="topbar-right">
            <div
              className="lang-toggle"
              role="group"
              aria-label="Language selector"
            >
              <button
                type="button"
                className={`lang-btn ${lang === "bn" ? "active" : ""}`}
                onClick={() => setLang("bn")}
                title="বাংলায় দেখুন"
              >
                বাং
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                title="View in English"
              >
                EN
              </button>
            </div>

            <span className="profile-top">
              <span className="avatar small">{t[lang].avatar}</span>
              <span>{t[lang].profileName}</span>
            </span>
          </div>
        </header>

        <div className="content-wrap">
          {view === "overview" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="status-dot" /> {t[lang].welcomeEyebrow}
                  </div>
                  <h1>{t[lang].welcomeTitle}</h1>
                  <p className="welcome-copy">{t[lang].welcomeCopy}</p>
                </div>
                <span className="date-pill">
                  <Icon name="calendar" size={16} /> {t[lang].datePill}
                </span>
              </section>

              <div className="demo-banner">
                <Icon name="shield" size={16} />
                <span>{t[lang].demoBanner}</span>
              </div>

              {/* Metric Cards */}
              <section
                className="summary-grid"
                aria-label="Health metric summary"
              >
                {/* Glucose Card */}
                <article className="metric-card">
                  <div className="metric-top">
                    <span className="metric-icon glucose-icon">
                      <Icon name="drop" size={18} />
                    </span>
                    <span className="metric-label">{t[lang].bloodSugar}</span>
                  </div>
                  <div className="metric-value">
                    {fmt(mgdlToMmol(latest.glucoseMgDl))} <span>mmol/L</span>
                  </div>
                  <div className="metric-bottom">
                    <span>
                      {t[lang].latest} · {formatTime(latest.time, lang)}
                    </span>
                    <span>
                      {t[lang].fromFirst}{" "}
                      <b>
                        {fmt(Math.abs(glucoseChange))}{" "}
                        {glucoseChange >= 0 ? t[lang].higher : t[lang].lower}
                      </b>
                    </span>
                  </div>
                </article>

                {/* Blood Pressure Card */}
                <article className="metric-card">
                  <div className="metric-top">
                    <span className="metric-icon pressure-icon">
                      <Icon name="heart" size={18} />
                    </span>
                    <span className="metric-label">{t[lang].bloodPressure}</span>
                  </div>
                  <div className="metric-value">
                    {fmt(latest.systolic)}
                    <span className="slash">/</span>
                    {fmt(latest.diastolic)} <span>mmHg</span>
                  </div>
                  <div className="metric-bottom">
                    <span>
                      {t[lang].latest} · {formatTime(latest.time, lang)}
                    </span>
                    <span>
                      {t[lang].fromFirst}{" "}
                      <b>
                        {fmt(Math.abs(pressureChange))} mmHg{" "}
                        {pressureChange >= 0 ? t[lang].higher : t[lang].lower}
                      </b>
                    </span>
                  </div>
                </article>

                {/* Pattern Comparison Card */}
                <article className="metric-card pattern-card">
                  <div className="metric-top">
                    <span className="metric-icon pattern-icon">
                      <Icon name="chart" size={18} />
                    </span>
                    <span className="metric-label">
                      {t[lang].sampleComparison}
                    </span>
                    <span className="period-label">
                      {fmt(readings.length, 0)} {t[lang].readingsSuffix}
                    </span>
                  </div>
                  <div className="pattern-title">{patternTitle}</div>
                  <div className="pattern-copy">{explanation}</div>
                  <button
                    className="text-link"
                    onClick={() => setView("learning")}
                  >
                    {t[lang].viewBaselineLink} <Icon name="arrow" size={14} />
                  </button>
                </article>
              </section>

              {/* Main Grid: Trends & Insights */}
              <section className="main-grid">
                <article className="panel trend-panel">
                  <div className="panel-header">
                    <div>
                      <div className="section-kicker">
                        {t[lang].trendKicker}
                      </div>
                      <h2>{t[lang].trendTitle}</h2>
                    </div>
                    <div className="segmented">
                      <button
                        className={metric === "glucose" ? "selected" : ""}
                        onClick={() => setMetric("glucose")}
                      >
                        {t[lang].glucoseTab}
                      </button>
                      <button
                        className={metric === "pressure" ? "selected" : ""}
                        onClick={() => setMetric("pressure")}
                      >
                        {t[lang].pressureTab}
                      </button>
                    </div>
                  </div>
                  <div className="chart-caption">
                    <span>
                      {metric === "glucose"
                        ? t[lang].bloodSugar
                        : t[lang].systolicBP}{" "}
                      <span className="chart-unit">
                        ({metric === "glucose" ? "mmol/L" : "mmHg"})
                      </span>
                    </span>
                    <span className="chart-average">
                      {t[lang].weeklyAvg}{" "}
                      <strong>
                        {metric === "glucose"
                          ? fmt(averageGlucose)
                          : fmt(averageSystolic)}{" "}
                        {metric === "glucose" ? "mmol/L" : "mmHg"}
                      </strong>
                    </span>
                  </div>
                  <TrendChart readings={readings} metric={metric} />
                  <div className="chart-dates">
                    {readings.slice(-7).map((item, index) => (
                      <span key={`${item.id}-${index}`}>
                        {formatDate(item.date, lang)}
                      </span>
                    ))}
                  </div>
                  <div className="chart-footnote">
                    <span className="chart-legend-dot" /> {t[lang].demoRecord}{" "}
                    <span className="chart-source">
                      {t[lang].demoRecordFootnote}
                    </span>
                  </div>
                </article>

                <article className="panel insight-panel">
                  <div className="insight-heading">
                    <span className="insight-spark">
                      <Icon name="chart" size={17} />
                    </span>
                    <div>
                      <div className="section-kicker">
                        {t[lang].insightKicker}
                      </div>
                      <h2>{t[lang].insightTitle}</h2>
                    </div>
                  </div>
                  <div className="insight-callout">
                    <span className="callout-line" />
                    <p>{explanation}</p>
                  </div>
                  <div className="insight-foot">
                    <span className="info-dot">i</span>
                    <span>{t[lang].insightFoot}</span>
                  </div>
                  <button className="insight-link" onClick={openShare}>
                    {t[lang].demoDoctorLink} <Icon name="arrow" size={15} />
                  </button>
                </article>
              </section>

              {/* Bottom Grid: Recent Table & Habits */}
              <section className="bottom-grid">
                <article className="panel recent-panel">
                  <div className="panel-header">
                    <div>
                      <div className="section-kicker">
                        {t[lang].recentKicker}
                      </div>
                      <h2>{t[lang].recentTitle}</h2>
                    </div>
                    <button
                      className="quiet-link"
                      onClick={() => setView("learning")}
                    >
                      {t[lang].baselineTest} <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <div className="reading-table">
                    <div className="table-head">
                      <span>{t[lang].colDateTime}</span>
                      <span>{t[lang].colGlucose}</span>
                      <span>{t[lang].colPressure}</span>
                      <span>{t[lang].colType}</span>
                    </div>
                    {readings
                      .slice(-4)
                      .reverse()
                      .map((reading) => (
                        <div className="reading-row" key={reading.id}>
                          <span className="reading-date">
                            <strong>{formatDate(reading.date, lang)}</strong>
                            <small>{formatTime(reading.time, lang)}</small>
                          </span>
                          <span>
                            {fmt(mgdlToMmol(reading.glucoseMgDl))}{" "}
                            <small>mmol/L</small>
                          </span>
                          <span>
                            {fmt(reading.systolic)}/{fmt(reading.diastolic)}{" "}
                            <small>mmHg</small>
                          </span>
                          <span className="source-chip">
                            <span />
                            {sourceName(reading.source, lang)}
                          </span>
                        </div>
                      ))}
                  </div>
                </article>

                <article className="panel routine-panel">
                  <div className="panel-header">
                    <div>
                      <div className="section-kicker">
                        {t[lang].routineKicker}
                      </div>
                      <h2>{t[lang].routineTitle}</h2>
                    </div>
                    <span className="routine-mark">
                      <Icon name="clipboard" size={18} />
                    </span>
                  </div>
                  <div className="routine-progress">
                    <span
                      style={{
                        width: `${
                          (checkedCount / currentRoutineItems.length) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="routine-quote">
                    {fmt(checkedCount, 0)} / {fmt(currentRoutineItems.length, 0)}{" "}
                    {t[lang].habitsLogged}
                  </div>
                  <div className="routine-note">{t[lang].routineNote}</div>
                  <button
                    className="routine-action"
                    onClick={() => setView("routine")}
                  >
                    {t[lang].openHabits} <Icon name="arrow" size={14} />
                  </button>
                </article>
              </section>

              {/* Bottom Actions */}
              <section className="bottom-actions">
                <div className="last-updated">
                  <span className="live-dot" /> {t[lang].sessionNote}
                </div>
                <button className="primary-button" onClick={openEntry}>
                  <Icon name="plus" size={18} /> {t[lang].addReading}
                </button>
              </section>
            </>
          )}

          {view === "routine" && (
            <RoutinePage
              lang={lang}
              done={routineDone}
              onToggle={(id) =>
                setRoutineDone((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id]
                )
              }
              onOpenEntry={openEntry}
            />
          )}

          {view === "learning" && (
            <LearningPage
              lang={lang}
              scenario={demoScenario}
              setScenario={setDemoScenario}
              day={demoDay}
              setDay={setDemoDay}
              metric={demoMetric}
              setMetric={setDemoMetric}
              series={demoSeries}
              analysis={demoAnalysis}
            />
          )}

          {view === "clinician" && (
            <ClinicianPage
              lang={lang}
              readings={readings}
              averageGlucose={averageGlucose}
              averageSystolic={averageSystolic}
              averageDiastolic={averageDiastolic}
              sharePeriod={sharePeriod}
              shareGlucose={shareGlucose}
              sharePressure={sharePressure}
              onRevoke={() => setView("overview")}
            />
          )}

          <footer className="disclaimer">
            <Icon name="shield" size={15} />
            <span>{t[lang].disclaimer}</span>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="Mobile Menu">
        {[
          { view: "overview" as View, title: t[lang].navOverview, icon: "home" },
          { view: "routine" as View, title: t[lang].navRoutine, icon: "clipboard" },
          { view: "learning" as View, title: t[lang].navLearning, icon: "chart" },
          { view: "clinician" as View, title: t[lang].clinicianTab, icon: "share" },
        ].map((item) => (
          <button
            key={item.view}
            className={view === item.view ? "active" : ""}
            onClick={() =>
              item.view === "clinician" ? openShare() : setView(item.view)
            }
          >
            <Icon name={item.icon} size={18} />
            <span>{item.title}</span>
          </button>
        ))}
      </nav>

      {/* Shifa Floating Launcher */}
      <button
        className="shifa-launcher"
        onClick={() => setShowShifa(true)}
        aria-label="Open Shifa Assistant"
      >
        <span className="shifa-launcher-mark">
          <Icon name="heartFilled" size={17} />
        </span>
        <span>{t[lang].shifaName}</span>
      </button>

      {showShifa && (
        <ShifaPanel
          lang={lang}
          messages={shifaMessages}
          question={shifaQuestion}
          setQuestion={setShifaQuestion}
          consent={shifaConsent}
          setConsent={setShifaConsent}
          sending={shifaSending}
          error={shifaError}
          contextLabel={viewLabels[view]}
          onAsk={askShifa}
          onAction={runShifaAction}
          onClose={() => setShowShifa(false)}
        />
      )}

      {showEntry && (
        <EntryModal
          lang={lang}
          entryMode={entryMode}
          setEntryMode={setEntryMode}
          glucose={glucose}
          setGlucose={setGlucose}
          systolic={systolic}
          setSystolic={setSystolic}
          diastolic={diastolic}
          setDiastolic={setDiastolic}
          glucoseUnit={glucoseUnit}
          setGlucoseUnit={setGlucoseUnit}
          checkinText={checkinText}
          setCheckinText={setCheckinText}
          aiConsent={aiConsent}
          setAiConsent={setAiConsent}
          isParsing={isParsing}
          parseError={parseError}
          entryError={entryError}
          draftNeedsReview={draftNeedsReview}
          setDraftNeedsReview={setDraftNeedsReview}
          reviewConfirmed={reviewConfirmed}
          setReviewConfirmed={setReviewConfirmed}
          onParse={parseCheckin}
          onSave={saveReading}
          onClose={() => setShowEntry(false)}
          onOpenPhoto={() => {
            setShowEntry(false);
            router.push("/import");
          }}
        />
      )}

      {showShare && (
        <ShareModal
          lang={lang}
          step={shareStep}
          period={sharePeriod}
          setPeriod={setSharePeriod}
          glucose={shareGlucose}
          setGlucose={setShareGlucose}
          pressure={sharePressure}
          setPressure={setSharePressure}
          token={demoToken}
          error={shareError}
          onCreate={createDemoShare}
          onSimulateScan={simulateDoctorScan}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

function RoutinePage({
  lang,
  done,
  onToggle,
  onOpenEntry,
}: {
  lang: "bn" | "en";
  done: string[];
  onToggle: (id: string) => void;
  onOpenEntry: () => void;
}) {
  const items = lang === "bn" ? routineItemsBn : routineItemsEn;
  const fmtNum = (val: number) =>
    new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(val);

  return (
    <section className="feature-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />{" "}
            {lang === "bn" ? "নমুনা রুটিন" : "Sample Routine"}
          </div>
          <h1>{lang === "bn" ? "আজকের অভ্যাস" : "Today's Habits"}</h1>
          <p className="welcome-copy">
            {lang === "bn"
              ? "ডায়াবেটিস ও উচ্চ রক্তচাপের দৈনন্দিন যত্ন দেখানোর জন্য একটি ইন্টারঅ্যাকটিভ ডেমো।"
              : "An interactive demo demonstrating daily care habits for diabetes and hypertension."}
          </p>
        </div>
        <span className="demo-chip">
          {lang === "bn" ? "শুধু ডেমো" : "Demo Only"}
        </span>
      </div>
      <div className="demo-banner">
        <Icon name="shield" size={16} />
        <span>
          {lang === "bn"
            ? "এগুলো চিকিৎসকের অনুমোদিত ব্যক্তিগত পরিকল্পনা নয়। কোনো ওষুধ বা চিকিৎসার নির্দেশ এখানে দেওয়া হচ্ছে না।"
            : "These are not physician-approved care plans. No medical or medication guidance is provided."}
        </span>
      </div>
      <div className="routine-layout">
        <article className="panel routine-list-panel">
          <div className="panel-header">
            <div>
              <div className="section-kicker">
                {lang === "bn" ? "নিজের জন্য নোট" : "Personal Notes"}
              </div>
              <h2>
                {lang === "bn" ? "আজ যা করতে পারেন" : "What You Can Do Today"}
              </h2>
            </div>
            <span className="routine-total">
              {fmtNum(done.length)} / {fmtNum(items.length)}
            </span>
          </div>
          {items.map((item) => (
            <label
              className={`routine-item ${
                done.includes(item.id) ? "completed" : ""
              }`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={done.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span className="routine-check" />
              <span className="routine-item-copy">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </label>
          ))}
          <button className="primary-button" onClick={onOpenEntry}>
            <Icon name="plus" size={17} />{" "}
            {lang === "bn" ? "রিডিং যোগ করুন" : "Add Reading"}
          </button>
        </article>

        <aside className="panel routine-context">
          <div className="section-kicker">
            {lang === "bn"
              ? "কীভাবে এটি পরে কাজ করতে পারে"
              : "How It Works in Production"}
          </div>
          <h2>
            {lang === "bn"
              ? "আপনার পরিকল্পনার সঙ্গে মিলিয়ে"
              : "Aligned With Your Care Plan"}
          </h2>
          <p>
            {lang === "bn"
              ? "বাস্তব পণ্যে রোগীর পছন্দ ও চিকিৎসকের সঙ্গে ঠিক করা লক্ষ্য অনুযায়ী কাজগুলো সাজানো হবে। ঘড়ি থাকলে পদক্ষেপ বা ঘুমের সারাংশ ঐচ্ছিকভাবে যোগ হতে পারে।"
              : "In a real product, actions will adapt to patient preferences and clinician targets. Smartwatch steps and sleep summaries can sync optionally."}
          </p>
          <div className="context-list">
            <span>
              <Icon name="steps" size={17} />{" "}
              {lang === "bn" ? "পদক্ষেপ ও চলাফেরা" : "Steps & Movement"}
            </span>
            <span>
              <Icon name="moon" size={17} />{" "}
              {lang === "bn" ? "ঘুমের সময়" : "Sleep Duration"}
            </span>
            <span>
              <Icon name="heart" size={17} />{" "}
              {lang === "bn" ? "নির্ধারিত মাপের রিমাইন্ডার" : "Scheduled Reminders"}
            </span>
          </div>
          <div className="entry-source">
            <Icon name="shield" size={15} />{" "}
            {lang === "bn"
              ? "কোনো তথ্য ডিভাইস থেকে আসছে না। এই তালিকা রিফ্রেশে মুছে যাবে।"
              : "No live hardware connected. Resets on page reload."}
          </div>
        </aside>
      </div>
    </section>
  );
}

function LearningPage({
  lang,
  scenario,
  setScenario,
  day,
  setDay,
  metric,
  setMetric,
  series,
  analysis,
}: {
  lang: "bn" | "en";
  scenario: DemoScenario;
  setScenario: (scenario: DemoScenario) => void;
  day: number;
  setDay: (day: number) => void;
  metric: DemoMetric;
  setMetric: (metric: DemoMetric) => void;
  series: ReturnType<typeof createDemoSeries>;
  analysis: ReturnType<typeof analyzeDemoSeries>;
}) {
  const fmtNum = (val: number, digits = 1) =>
    new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", {
      maximumFractionDigits: digits,
    }).format(val);

  const scenarioOptions = [
    {
      id: "steady" as DemoScenario,
      title: lang === "bn" ? "স্থিতিশীল নমুনা" : "Steady Control",
      description: lang === "bn" ? "ছোট স্বাভাবিক ওঠানামা" : "Minor natural variance",
    },
    {
      id: "gradual-change" as DemoScenario,
      title: lang === "bn" ? "ধীরে পরিবর্তন" : "Gradual Drift",
      description:
        lang === "bn" ? "কয়েকটি ধারার মান সরে যায়" : "Multi-stream sustained drift",
    },
    {
      id: "noisy" as DemoScenario,
      title: lang === "bn" ? "অনিয়মিত মান" : "Irregular Values",
      description:
        lang === "bn" ? "ওঠানামা বেশি, স্থায়ী ধারা কম" : "High noise, weak trend",
    },
    {
      id: "missing-data" as DemoScenario,
      title: lang === "bn" ? "তথ্য অনুপস্থিত" : "Missing Data",
      description:
        lang === "bn" ? "শেষের কিছু দিন মাপা হয়নি" : "Unmonitored trailing days",
    },
  ];

  const metricOptions: { id: DemoMetric; title: string }[] = [
    { id: "glucose", title: lang === "bn" ? "শর্করা" : "Glucose" },
    { id: "pressure", title: lang === "bn" ? "রক্তচাপ" : "Pressure" },
    { id: "steps", title: lang === "bn" ? "পদক্ষেপ" : "Steps" },
    { id: "sleep", title: lang === "bn" ? "ঘুম" : "Sleep" },
    { id: "resting-heart-rate", title: lang === "bn" ? "হার্ট রেট" : "Heart Rate" },
  ];

  return (
    <section className="feature-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />{" "}
            {lang === "bn" ? "সিন্থেটিক শেখার ডেমো" : "Synthetic Learning Demo"}
          </div>
          <h1>
            {lang === "bn"
              ? "নিজের বেসলাইন কীভাবে তৈরি হয়"
              : "How Personal Baselines Form"}
          </h1>
          <p className="welcome-copy">
            {lang === "bn"
              ? "একটি কৃত্রিম উদাহরণে রেফারেন্স সময়, সাম্প্রতিক মান এবং অনুপস্থিত তথ্য দেখুন।"
              : "Observe reference windows, rolling deviation, and missing data handling on synthetic data."}
          </p>
        </div>
        <span className="demo-chip">
          {lang === "bn" ? "ক্লিনিক্যাল মডেল নয়" : "Not a Clinical Model"}
        </span>
      </div>

      <div className="demo-banner">
        <Icon name="shield" size={16} />
        <span>
          {lang === "bn"
            ? "সব মান তৈরি করা নমুনা। এখানে কোনো ব্যক্তির শরীর শেখা হচ্ছে না, কোনো রোগের পূর্বাভাসও দেওয়া হচ্ছে না।"
            : "All values are synthetic. No individual biology is being modeled, and no disease prediction is made."}
        </span>
      </div>

      <div className="learning-layout">
        <article className="panel learning-panel">
          <div className="panel-header">
            <div>
              <div className="section-kicker">
                {lang === "bn" ? "নমুনা পরিস্থিতি" : "Scenario"}
              </div>
              <h2>
                {lang === "bn" ? "একটি ধারা বেছে নিন" : "Select a Trajectory"}
              </h2>
            </div>
            <span className="learning-index">
              {fmtNum(day, 0)} / {fmtNum(28, 0)} {lang === "bn" ? "দিন" : "Days"}
            </span>
          </div>

          <div className="scenario-grid">
            {scenarioOptions.map((option) => (
              <button
                key={option.id}
                className={`scenario-card ${
                  scenario === option.id ? "selected" : ""
                }`}
                onClick={() => {
                  setScenario(option.id);
                  setDay(28);
                }}
              >
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <label className="timeline-control">
            {lang === "bn" ? "ডেমো সময় এগিয়ে নিন" : "Scrub Timeline"}
            <input
              type="range"
              min="5"
              max="28"
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
            />
            <span>
              <span>{lang === "bn" ? "শুরু" : "Start"}</span>
              <span>{lang === "bn" ? "শেষ" : "End"}</span>
            </span>
          </label>

          <div className="segmented metric-switch">
            {metricOptions.map((option) => (
              <button
                key={option.id}
                className={metric === option.id ? "selected" : ""}
                onClick={() => setMetric(option.id)}
              >
                {option.title}
              </button>
            ))}
          </div>

          <div className="learning-chart-wrap">
            <DemoChart series={series} metric={metric} />
            <div className="chart-dates">
              <span>{lang === "bn" ? "দিন ১" : "Day 1"}</span>
              <span>
                {lang === "bn" ? "দিন ১৪ · বেসলাইন" : "Day 14 · Baseline"}
              </span>
              <span>
                {lang === "bn"
                  ? `দিন ${fmtNum(day, 0)}`
                  : `Day ${fmtNum(day, 0)}`}
              </span>
            </div>
            <div className="chart-footnote">
              <span className="baseline-legend" />{" "}
              {lang === "bn"
                ? "প্রথম ১৪ দিনের নমুনা রেফারেন্স"
                : "Initial 14-day rolling baseline"}{" "}
              <span className="chart-source">
                {lang === "bn"
                  ? "ফাঁকা বিন্দু = তথ্য নেই"
                  : "Hollow dot = missing data"}
              </span>
            </div>
          </div>
        </article>

        <aside className="panel learning-summary">
          <div className="section-kicker">
            {lang === "bn" ? "ডেমো ইঞ্জিনের পাঠ" : "Engine Assessment"}
          </div>
          <h2>
            {!analysis.ready
              ? lang === "bn"
                ? "বেসলাইন এখনো তৈরি হয়নি"
                : "Baseline Not Ready Yet"
              : analysis.shiftedSignals >= 2
              ? lang === "bn"
                ? "একাধিক নমুনা ধারায় পরিবর্তন"
                : "Multi-Stream Drift Detected"
              : analysis.shiftedSignals === 1
              ? lang === "bn"
                ? "একটি নমুনা ধারায় পরিবর্তন"
                : "Single-Stream Drift"
              : lang === "bn"
              ? "নমুনা মান রেফারেন্সের কাছাকাছি"
              : "Signals Near Baseline"}
          </h2>
          <p className="learning-explainer">
            {!analysis.ready
              ? lang === "bn"
                ? "রেফারেন্স দেখানোর আগে ডেমোতে ১৪ দিনের তথ্য অপেক্ষা করা হচ্ছে।"
                : "Awaiting 14 days of data to establish baseline."
              : analysis.shiftedSignals >= 2
              ? lang === "bn"
                ? "নির্বাচিত নমুনায় একাধিক ধারার সাম্প্রতিক গড় প্রথম ১৪ দিনের নমুনা রেফারেন্স থেকে সরে গেছে।"
                : "Recent averages across two or more streams have drifted significantly from the 14-day baseline."
              : analysis.shiftedSignals === 1
              ? lang === "bn"
                ? "একটি ধারার সাম্প্রতিক গড় নমুনা রেফারেন্স থেকে সরে গেছে। একটি মাত্র পরিবর্তন থেকে সিদ্ধান্ত নেওয়া হয় না।"
                : "Only one stream shows drift. The engine withholds escalation to prevent false alert fatigue."
              : lang === "bn"
              ? "এই নমুনা পরিস্থিতিতে সাম্প্রতিক গড়গুলো প্রথম ১৪ দিনের রেফারেন্সের কাছাকাছি আছে।"
              : "Recent averages remain within normal statistical bounds of the 14-day reference."}
          </p>

          <div className="signal-list">
            {analysis.signals.map((signal) => (
              <div className="signal-row" key={signal.metric}>
                <span>
                  <strong>{signal.title}</strong>
                  <small>
                    {lang === "bn" ? "রেফারেন্স" : "Ref"}{" "}
                    {signal.baseline === null
                      ? lang === "bn"
                        ? "তৈরি হয়নি"
                        : "N/A"
                      : `${fmtNum(signal.baseline, 1)} ${signal.unit}`}{" "}
                    · {lang === "bn" ? "সাম্প্রতিক" : "Recent"}{" "}
                    {signal.recent === null
                      ? lang === "bn"
                        ? "তথ্য কম"
                        : "Low data"
                      : `${fmtNum(signal.recent, 1)} ${signal.unit}`}
                  </small>
                </span>
                <span
                  className={`signal-state ${signal.shifted ? "changed" : ""}`}
                >
                  {!analysis.ready
                    ? lang === "bn"
                      ? "শেখা চলছে"
                      : "Learning"
                    : signal.recent === null || signal.baseline === null
                    ? lang === "bn"
                      ? "তথ্য কম"
                      : "Low Data"
                    : signal.shifted
                    ? lang === "bn"
                      ? "সরে গেছে"
                      : "Drifted"
                    : lang === "bn"
                    ? "কাছাকাছি"
                    : "Normal"}
                </span>
              </div>
            ))}
          </div>
          <div className="entry-source">
            <Icon name="shield" size={15} />{" "}
            {lang === "bn"
              ? "ডেমোর নিয়মে প্রথম ১৪ দিন রেফারেন্স এবং পরের ৭ দিন তুলনা করা হয়।"
              : "Demo rule: 14-day reference compared against rolling 7-day window."}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ClinicianPage({
  lang,
  readings,
  averageGlucose,
  averageSystolic,
  averageDiastolic,
  sharePeriod,
  shareGlucose,
  sharePressure,
  onRevoke,
}: {
  lang: "bn" | "en";
  readings: Reading[];
  averageGlucose: number;
  averageSystolic: number;
  averageDiastolic: number;
  sharePeriod: string;
  shareGlucose: boolean;
  sharePressure: boolean;
  onRevoke: () => void;
}) {
  const records = sharePeriod === "week" ? readings.slice(-7) : readings;
  const fmtNum = (val: number, digits = 1) =>
    new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", {
      maximumFractionDigits: digits,
    }).format(val);

  return (
    <section className="feature-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />{" "}
            {lang === "bn" ? "সিমুলেটেড চিকিৎসক ভিউ" : "Simulated Clinician View"}
          </div>
          <h1>
            {lang === "bn"
              ? "রাফি আহমেদের স্বাস্থ্য সারাংশ"
              : "Rafi Ahmed's Health Brief"}
          </h1>
          <p className="welcome-copy">
            {lang === "bn"
              ? "রোগীর অনুমোদিত সীমার অনুকরণ · নমুনা প্রোফাইল"
              : "Patient-authorized data scope · Sample Profile"}
          </p>
        </div>
        <span className="demo-chip">
          {lang === "bn" ? "বাস্তব শেয়ার নয়" : "Simulation"}
        </span>
      </div>

      <div className="demo-banner">
        <Icon name="shield" size={16} />
        <span>
          {lang === "bn"
            ? "এই স্ক্রিনটি QR স্ক্যানের পর চিকিৎসক কী দেখতে পারেন তার নমুনা।"
            : "Simulated physician interface accessed via patient-consented QR handshake."}
        </span>
      </div>

      <div className="clinician-access">
        <div>
          <span className="access-label">
            {lang === "bn" ? "ডেমো টোকেন" : "Access Token"}
          </span>
          <strong>
            {sharePeriod === "all"
              ? lang === "bn"
                ? "সব নমুনা ইতিহাস"
                : "Full History"
              : lang === "bn"
              ? "শেষ ৭ দিনের নমুনা"
              : "Trailing 7 Days"}
          </strong>
        </div>
        <div>
          <span className="access-label">
            {lang === "bn" ? "অনুমোদিত বিভাগ" : "Authorized Scopes"}
          </span>
          <strong>
            {[
              shareGlucose && (lang === "bn" ? "রক্তে শর্করা" : "Glucose"),
              sharePressure && (lang === "bn" ? "রক্তচাপ" : "Blood Pressure"),
            ]
              .filter(Boolean)
              .join(lang === "bn" ? " ও " : " & ") ||
              (lang === "bn" ? "কোনো বিভাগ নেই" : "None")}
          </strong>
        </div>
        <button className="quiet-link" onClick={onRevoke}>
          {lang === "bn" ? "ডেমো অ্যাক্সেস বন্ধ করুন" : "Revoke Session"}
        </button>
      </div>

      <section className="summary-grid clinician-metrics">
        {shareGlucose && (
          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon glucose-icon">
                <Icon name="drop" size={17} />
              </span>
              <span className="metric-label">
                {lang === "bn" ? "নমুনা গড় শর্করা" : "Mean Glucose"}
              </span>
            </div>
            <div className="metric-value">
              {fmtNum(averageGlucose)} <span>mmol/L</span>
            </div>
            <div className="metric-bottom">
              {fmtNum(records.length, 0)}{" "}
              {lang === "bn" ? "টি নমুনা রেকর্ড" : "records in scope"}
            </div>
          </article>
        )}
        {sharePressure && (
          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon pressure-icon">
                <Icon name="heart" size={17} />
              </span>
              <span className="metric-label">
                {lang === "bn" ? "নমুনা গড় রক্তচাপ" : "Mean Blood Pressure"}
              </span>
            </div>
            <div className="metric-value">
              {fmtNum(averageSystolic)}/{fmtNum(averageDiastolic)}{" "}
              <span>mmHg</span>
            </div>
            <div className="metric-bottom">
              {fmtNum(records.length, 0)}{" "}
              {lang === "bn" ? "টি নমুনা রেকর্ড" : "records in scope"}
            </div>
          </article>
        )}
      </section>

      <article className="panel clinician-timeline">
        <div className="panel-header">
          <div>
            <div className="section-kicker">
              {lang === "bn" ? "নমুনা ইতিহাস" : "Telemetry Audit"}
            </div>
            <h2>
              {lang === "bn" ? "রিডিংয়ের সময়রেখা" : "Longitudinal Timeline"}
            </h2>
          </div>
          <span className="period-label">
            {sharePeriod === "all"
              ? lang === "bn"
                ? "সব নমুনা দিন"
                : "All Days"
              : lang === "bn"
              ? "শেষ ৭ দিন"
              : "Last 7 Days"}
          </span>
        </div>
        <div className="reading-table">
          <div className="table-head">
            <span>{lang === "bn" ? "তারিখ ও সময়" : "Date & Time"}</span>
            {shareGlucose && (
              <span>{lang === "bn" ? "শর্করা" : "Glucose"}</span>
            )}
            {sharePressure && (
              <span>{lang === "bn" ? "রক্তচাপ" : "Blood Pressure"}</span>
            )}
            <span>{lang === "bn" ? "উৎস" : "Source"}</span>
          </div>
          {records
            .slice()
            .reverse()
            .map((reading) => (
              <div className="reading-row" key={reading.id}>
                <span className="reading-date">
                  <strong>{formatDate(reading.date, lang)}</strong>
                  <small>{formatTime(reading.time, lang)}</small>
                </span>
                {shareGlucose && (
                  <span>
                    {fmtNum(mgdlToMmol(reading.glucoseMgDl))}{" "}
                    <small>mmol/L</small>
                  </span>
                )}
                {sharePressure && (
                  <span>
                    {fmtNum(reading.systolic)}/{fmtNum(reading.diastolic)}{" "}
                    <small>mmHg</small>
                  </span>
                )}
                <span className="source-chip">
                  {sourceName(reading.source, lang)}
                </span>
              </div>
            ))}
        </div>
      </article>
    </section>
  );
}

function ShifaPanel(props: {
  lang: "bn" | "en";
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

  const suggestions =
    props.lang === "bn"
      ? [
          "এই সময়ের রিডিং বুঝিয়ে বলুন",
          "আজকের অভ্যাস দেখান",
          "ডাক্তারের জন্য সারাংশ তৈরি করুন",
        ]
      : [
          "Explain current readings",
          "Show today's habits",
          "Generate doctor summary brief",
        ];

  const actionLabels: Record<Exclude<ShifaAction, null>, string> = {
    open_routine:
      props.lang === "bn" ? "দৈনিক অভ্যাস খুলুন" : "Open Daily Habits",
    open_share:
      props.lang === "bn" ? "সারাংশের সীমা বেছে নিন" : "Select Sharing Scope",
    open_entry: props.lang === "bn" ? "রিডিং যোগ করুন" : "Add Reading",
    open_learning:
      props.lang === "bn" ? "বেসলাইন ডেমো দেখুন" : "View Baseline Demo",
  };

  return (
    <div
      className="shifa-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <aside
        className="shifa-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Shifa Assistant"
      >
        <header className="shifa-header">
          <div className="shifa-avatar">
            <Icon name="heartFilled" size={18} />
          </div>
          <div className="shifa-identity">
            <strong>{props.lang === "bn" ? "শিফা" : "Shifa"}</strong>
            <span>
              {props.lang === "bn"
                ? "লাইফলুপের সহকারী"
                : "LifeLoop Care Assistant"}
            </span>
          </div>
          <span className="shifa-mode">
            {props.lang === "bn" ? "ডেমো" : "Demo"}
          </span>
          <button
            className="modal-close"
            onClick={props.onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="shifa-context">
          <span className="status-dot" />{" "}
          {props.lang === "bn" ? "বর্তমান পাতা" : "Current View"}:{" "}
          {props.contextLabel}{" "}
          <span>
            {props.lang === "bn" ? "নমুনা প্রোফাইল" : "Sample Profile"}
          </span>
        </div>

        <div className="shifa-messages" aria-live="polite">
          {props.messages.map((message) => (
            <article
              className={`shifa-message ${message.role}`}
              key={message.id}
            >
              <div className="shifa-bubble">{message.text}</div>
              {message.role === "assistant" && (
                <>
                  {message.basis && (
                    <div className="shifa-evidence">
                      {props.lang === "bn"
                        ? `তথ্যের ভিত্তি: ${message.basis}`
                        : `Basis: ${message.basis}`}
                    </div>
                  )}
                  {message.mode === "demo-fallback" && (
                    <div className="shifa-fallback-note">
                      {props.lang === "bn"
                        ? "এআই সংযোগ নেই; সীমিত ডেমো নিয়মে উত্তর"
                        : "AI offline; fallback rule reply"}
                    </div>
                  )}
                  {message.action && (
                    <button
                      className="shifa-action"
                      onClick={() => props.onAction(message.action!)}
                    >
                      {actionLabels[message.action]}{" "}
                      <Icon name="arrow" size={14} />
                    </button>
                  )}
                </>
              )}
            </article>
          ))}
          {props.sending && (
            <div className="shifa-thinking" role="status">
              {props.lang === "bn"
                ? "শিফা ডেমো তথ্য মিলিয়ে দেখছে…"
                : "Shifa is evaluating telemetry…"}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {props.messages.length <= 1 && (
          <div className="shifa-suggestions">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => props.onAsk(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form
          className="shifa-composer"
          onSubmit={(event) => {
            event.preventDefault();
            props.onAsk(props.question);
          }}
        >
          <textarea
            value={props.question}
            onChange={(event) => props.setQuestion(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder={
              props.lang === "bn" ? "বাংলায় লিখুন…" : "Type your question…"
            }
            aria-label="Question for Shifa"
          />
          {props.error && (
            <p className="parse-feedback error" role="alert">
              {props.error}
            </p>
          )}
          <label className="shifa-consent">
            <input
              type="checkbox"
              checked={props.consent}
              onChange={(event) => props.setConsent(event.target.checked)}
            />
            <span>
              {props.lang === "bn"
                ? "আমার লেখা প্রশ্ন AI সেবায় পাঠানো হতে পারে। অ্যাপের রেকর্ডের তালিকা AI-তে পাঠানো হয় না।"
                : "My question text may be processed by AI. Longitudinal records are not exported."}
            </span>
          </label>
          <div className="shifa-compose-footer">
            <span>
              {props.lang === "bn"
                ? "শিফা রোগ নির্ণয় বা চিকিৎসার পরামর্শ দেয় না"
                : "Shifa does not diagnose or prescribe treatment"}
            </span>
            <button
              type="submit"
              disabled={
                !props.question.trim() || !props.consent || props.sending
              }
            >
              {props.lang === "bn" ? "পাঠান" : "Send"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function EntryModal(props: {
  lang: "bn" | "en";
  entryMode: "manual" | "checkin";
  setEntryMode: (mode: "manual" | "checkin") => void;
  glucose: string;
  setGlucose: (value: string) => void;
  systolic: string;
  setSystolic: (value: string) => void;
  diastolic: string;
  setDiastolic: (value: string) => void;
  glucoseUnit: GlucoseUnit | "";
  setGlucoseUnit: (value: GlucoseUnit | "") => void;
  checkinText: string;
  setCheckinText: (value: string) => void;
  aiConsent: boolean;
  setAiConsent: (value: boolean) => void;
  isParsing: boolean;
  parseError: string;
  entryError: string;
  draftNeedsReview: boolean;
  setDraftNeedsReview: (value: boolean) => void;
  reviewConfirmed: boolean;
  setReviewConfirmed: (value: boolean) => void;
  onParse: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onOpenPhoto: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">
              {props.lang === "bn" ? "শুধু ডেমো রেকর্ড" : "Demo Telemetry"}
            </div>
            <h2 id="entry-title">
              {props.lang === "bn" ? "নতুন রিডিং যোগ করুন" : "Add New Reading"}
            </h2>
          </div>
          <button
            className="modal-close"
            onClick={props.onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="modal-intro">
          {props.lang === "bn"
            ? "রিডিং লিখুন অথবা বাংলায় ছোট করে বলুন। সংরক্ষণের আগে প্রতিটি মান যাচাই করুন।"
            : "Enter reading values manually or via conversational text. Verify all values before saving."}
        </p>

        <button
          className="photo-import-link"
          type="button"
          onClick={props.onOpenPhoto}
        >
          {props.lang === "bn"
            ? "ডায়েরির ছবি থেকে খসড়া তৈরি করুন"
            : "Draft from health diary photo"}{" "}
          <Icon name="arrow" size={14} />
        </button>

        <div className="entry-tabs">
          <button
            className={props.entryMode === "manual" ? "selected" : ""}
            onClick={() => {
              if (props.draftNeedsReview) {
                props.setGlucose("");
                props.setSystolic("");
                props.setDiastolic("");
              }
              props.setEntryMode("manual");
              props.setReviewConfirmed(false);
            }}
          >
            {props.lang === "bn" ? "নিজে লিখুন" : "Manual Entry"}
          </button>
          <button
            className={props.entryMode === "checkin" ? "selected" : ""}
            onClick={() => props.setEntryMode("checkin")}
          >
            {props.lang === "bn" ? "বাংলায় লিখুন" : "Natural Text"}
          </button>
        </div>

        {props.entryMode === "checkin" && (
          <div className="checkin-panel">
            <label className="checkin-label" htmlFor="checkin-text">
              {props.lang === "bn"
                ? "আপনার রিডিংটি লিখুন"
                : "Type your reading in plain words"}
            </label>
            <textarea
              id="checkin-text"
              maxLength={700}
              value={props.checkinText}
              onChange={(event) => {
                props.setCheckinText(event.target.value);
                if (props.draftNeedsReview) {
                  props.setDraftNeedsReview(false);
                  props.setGlucose("");
                  props.setSystolic("");
                  props.setDiastolic("");
                  props.setGlucoseUnit("");
                  props.setReviewConfirmed(false);
                }
              }}
              placeholder={
                props.lang === "bn"
                  ? "যেমন: আজ সকালে শর্করা ৭.২ mmol/L, প্রেসার ১৩২ বাই ৮৪"
                  : "e.g., Morning sugar 7.2 mmol/L, blood pressure 132 over 84"
              }
            />
            <p className="privacy-copy">
              {props.lang === "bn"
                ? "এআই খসড়া তৈরির জন্য লেখাটি AI সেবায় পাঠানো হবে। পরিচয় বোঝায় এমন তথ্য লিখবেন না।"
                : "Text will be parsed via AI. Do not include personal identity details."}
            </p>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={props.aiConsent}
                onChange={(event) => props.setAiConsent(event.target.checked)}
              />
              <span>
                {props.lang === "bn"
                  ? "আমি বুঝেছি, আমার লেখা AI দিয়ে খসড়া তৈরির জন্য পাঠানো হবে।"
                  : "I understand this note will be structured using an AI parser."}
              </span>
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={
                !props.checkinText.trim() || !props.aiConsent || props.isParsing
              }
              onClick={props.onParse}
            >
              {props.isParsing
                ? props.lang === "bn"
                  ? "তথ্য যাচাই হচ্ছে…"
                  : "Parsing…"
                : props.lang === "bn"
                ? "রিডিংয়ের খসড়া তৈরি করুন"
                : "Generate Draft from Text"}
            </button>
            {props.parseError && (
              <p
                className={`parse-feedback ${
                  props.draftNeedsReview ? "notice" : "error"
                }`}
                role="status"
              >
                {props.parseError}
              </p>
            )}
          </div>
        )}

        {(props.entryMode === "manual" || props.draftNeedsReview) && (
          <form className="reading-form" onSubmit={props.onSave}>
            {props.draftNeedsReview && (
              <div className="draft-banner">
                <Icon name="shield" size={16} />
                <span>
                  {props.lang === "bn"
                    ? "এআই থেকে পাওয়া খসড়া। মূল রিডিংয়ের সঙ্গে প্রতিটি ঘর মিলিয়ে দেখুন।"
                    : "AI-generated draft. Please verify each metric against your device."}
                </span>
              </div>
            )}
            <label>
              {props.lang === "bn" ? "রক্তে শর্করা" : "Blood Glucose"}
              <select
                value={props.glucoseUnit}
                onChange={(event) => {
                  props.setGlucoseUnit(event.target.value as GlucoseUnit | "");
                  if (props.draftNeedsReview) props.setReviewConfirmed(false);
                }}
                required
              >
                <option value="">
                  {props.lang === "bn" ? "একক বাছুন" : "Select Unit"}
                </option>
                <option value="mmol/L">mmol/L</option>
                <option value="mg/dL">mg/dL</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder={props.lang === "bn" ? "যেমন ৭.২" : "e.g. 7.2"}
                value={props.glucose}
                onChange={(event) => {
                  props.setGlucose(event.target.value);
                  if (props.draftNeedsReview) props.setReviewConfirmed(false);
                }}
                required
              />
            </label>
            <div className="form-pair">
              <label>
                {props.lang === "bn" ? "সিস্টোলিক চাপ" : "Systolic BP"}{" "}
                <span>mmHg</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={props.lang === "bn" ? "যেমন ১৩২" : "e.g. 132"}
                  value={props.systolic}
                  onChange={(event) => {
                    props.setSystolic(event.target.value);
                    if (props.draftNeedsReview) props.setReviewConfirmed(false);
                  }}
                  required
                />
              </label>
              <label>
                {props.lang === "bn" ? "ডায়াস্টোলিক চাপ" : "Diastolic BP"}{" "}
                <span>mmHg</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={props.lang === "bn" ? "যেমন ৮৪" : "e.g. 84"}
                  value={props.diastolic}
                  onChange={(event) => {
                    props.setDiastolic(event.target.value);
                    if (props.draftNeedsReview) props.setReviewConfirmed(false);
                  }}
                  required
                />
              </label>
            </div>
            {props.entryError && (
              <p className="parse-feedback error" role="alert">
                {props.entryError}
              </p>
            )}
            {props.draftNeedsReview && (
              <label className="review-confirm">
                <input
                  type="checkbox"
                  checked={props.reviewConfirmed}
                  onChange={(event) =>
                    props.setReviewConfirmed(event.target.checked)
                  }
                  required
                />
                <span>
                  {props.lang === "bn"
                    ? "আমি প্রতিটি মান ও একক মিলিয়ে দেখেছি।"
                    : "I have verified all numbers and units."}
                </span>
              </label>
            )}
            {/* Inner Loop Deterministic Acute Safety Trigger */}
            {(Number(props.systolic) >= 180 || (Number(props.glucose) > 0 && Number(props.glucose) < 3.0 && props.glucoseUnit === "mmol/L")) && (
              <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: 8, padding: 12, marginBottom: 14, color: "#991b1b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 11 }}>
                  <Icon name="shield" size={16} />
                  <span>{props.lang === "bn" ? "🚨 জরুরি সতর্কতা (Inner Loop Safety Guard)" : "🚨 Emergency Alert (Inner Loop Safety Guard)"}</span>
                </div>
                <p style={{ margin: "5px 0 0", fontSize: 10, lineHeight: 1.5, color: "#b91c1c" }}>
                  {props.lang === "bn"
                    ? "রক্তচাপ ১৮০ mmHg বা বেশি। এটি হাইপারটেনসিভ ক্রাইসিস সীমা। এআই কোনো মতামত দেবে না — অবিলম্বে জরুরি সেবা বা হাসপাতালে যোগাযোগ করুন।"
                    : "Systolic BP >= 180 mmHg (Hypertensive Crisis). AI reasoning is bypassed — seek emergency clinical care immediately."}
                </p>
              </div>
            )}
            <div className="entry-source">
              <Icon name="shield" size={15} />
              {props.lang === "bn"
                ? "নতুন রেকর্ড শুধু এই ডেমো সেশনে থাকবে।"
                : "New entries persist only for this session."}
            </div>
            <button
              className="primary-button modal-submit"
              type="submit"
              disabled={props.draftNeedsReview && !props.reviewConfirmed}
            >
              {props.lang === "bn" ? "ডেমো রিডিং যোগ করুন" : "Save Demo Reading"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function ShareModal(props: {
  lang: "bn" | "en";
  step: ShareStep;
  period: string;
  setPeriod: (value: string) => void;
  glucose: boolean;
  setGlucose: (value: boolean) => void;
  pressure: boolean;
  setPressure: (value: boolean) => void;
  token: string;
  error: string;
  onCreate: () => void;
  onSimulateScan: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        className="modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">
              {props.lang === "bn" ? "সিমুলেটেড শেয়ার প্রবাহ" : "Sharing Protocol"}
            </div>
            <h2 id="share-title">
              {props.lang === "bn" ? "ডাক্তারের সঙ্গে ভাগ" : "Share with Doctor"}
            </h2>
          </div>
          <button
            className="modal-close"
            onClick={props.onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        {props.step === "choose" ? (
          <>
            <p className="modal-intro">
              {props.lang === "bn"
                ? "বাস্তব পণ্যে QR শুধু অনুমতি চাওয়ার নিরাপদ উপায় হবে। এই ডেমোতে কোনো তথ্য পাঠানো হয় না।"
                : "In production, the QR code performs a zero-trust handshake. No external transmission in demo."}
            </p>
            <label className="share-field">
              {props.lang === "bn" ? "কোন সময়ের তথ্য দেখাবেন" : "History Duration"}
              <select
                value={props.period}
                onChange={(event) => props.setPeriod(event.target.value)}
              >
                <option value="week">
                  {props.lang === "bn" ? "শেষ ৭ দিনের নমুনা" : "Last 7 Days"}
                </option>
                <option value="all">
                  {props.lang === "bn" ? "সব নমুনা ইতিহাস" : "Complete History"}
                </option>
              </select>
            </label>
            <div className="share-scopes">
              <span>
                {props.lang === "bn" ? "কোন তথ্য দেখাবেন" : "Select Scopes"}
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={props.glucose}
                  onChange={(event) => props.setGlucose(event.target.checked)}
                />{" "}
                {props.lang === "bn" ? "রক্তে শর্করা" : "Blood Glucose"}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={props.pressure}
                  onChange={(event) => props.setPressure(event.target.checked)}
                />{" "}
                {props.lang === "bn" ? "রক্তচাপ" : "Blood Pressure"}
              </label>
            </div>
            <div className="entry-source">
              <Icon name="shield" size={15} />{" "}
              {props.lang === "bn"
                ? "ডেমো QR-এ স্বাস্থ্যতথ্য বা আসল অ্যাকাউন্ট থাকে না।"
                : "Demo QR contains no PHI or live accounts."}
            </div>
            {props.error && (
              <p className="parse-feedback error" role="alert">
                {props.error}
              </p>
            )}
            <button
              className="primary-button modal-submit"
              onClick={props.onCreate}
              disabled={!props.glucose && !props.pressure}
            >
              {props.lang === "bn" ? "ডেমো QR তৈরি করুন" : "Generate Demo QR"}
            </button>
          </>
        ) : (
          <>
            <div className="qr-demo-wrap">
              <DemoQr token={props.token} />
              <div>
                <span className="demo-chip">
                  {props.lang === "bn" ? "স্ক্যানযোগ্য নয়" : "Unscannable Demo"}
                </span>
                <h3>
                  {props.lang === "bn"
                    ? "ডেমো অনুরোধ তৈরি হয়েছে"
                    : "Session Handshake Ready"}
                </h3>
                <p>
                  Token: <strong>{props.token}</strong>
                </p>
                <small>
                  {props.lang === "bn"
                    ? "আসল QR নয়। বাস্তব অ্যাকাউন্ট বা তথ্যের সঙ্গে যুক্ত নয়।"
                    : "Simulation only. Not linked to medical records."}
                </small>
              </div>
            </div>
            {props.error && (
              <p className="parse-feedback error" role="alert">
                {props.error}
              </p>
            )}
            <button
              className="primary-button modal-submit"
              onClick={props.onSimulateScan}
            >
              {props.lang === "bn"
                ? "ডাক্তারের স্ক্যান অনুকরণ করুন"
                : "Simulate Clinician Scan"}
            </button>
            <button className="text-link modal-back" onClick={props.onClose}>
              {props.lang === "bn" ? "বন্ধ করুন" : "Close"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}