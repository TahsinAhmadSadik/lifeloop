"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { demoPatients, demoShareStorageKey, isDemoSharePayload, type DemoPatient, type DemoReading, type DemoSharePayload } from "@/lib/demo-patients";
import { mgdlToMmol } from "@/lib/health";

type PortalView = "patients" | "shared";
type Metric = "glucose" | "pressure";

function bn(value: number, digits = 1) {
  return new Intl.NumberFormat("bn-BD", { maximumFractionDigits: digits }).format(value);
}

function sourceLabel(source: DemoReading["source"]) {
  if (source === "sample") return "নমুনা রেকর্ড";
  if (source === "ai-draft-demo") return "এআই খসড়া, যাচাই করা";
  return "ডেমোতে লেখা";
}

function PatientTrend({ readings, metric }: { readings: DemoReading[]; metric: Metric }) {
  const values = readings.map((record) => metric === "glucose"
    ? record.glucoseMgDl === null ? null : mgdlToMmol(record.glucoseMgDl)
    : record.systolic);
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return <div className="doctor-chart-empty">এই ভাগ করা সীমায় কোনো রিডিং নেই।</div>;
  const min = Math.min(...valid) - (metric === "glucose" ? 0.5 : 8);
  const max = Math.max(...valid) + (metric === "glucose" ? 0.5 : 8);
  const x = (index: number) => 24 + index * (552 / Math.max(values.length - 1, 1));
  const y = (value: number) => 148 - ((value - min) / Math.max(max - min, 1)) * 116;
  const segments: string[][] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    const previous = segments[segments.length - 1];
    if (!previous || values[index - 1] === null) segments.push([`${x(index)},${y(value)}`]);
    else previous.push(`${x(index)},${y(value)}`);
  });
  return <svg className="doctor-trend" viewBox="0 0 600 175" role="img" aria-label={metric === "glucose" ? "ভাগ করা নমুনা রক্তে শর্করার গ্রাফ" : "ভাগ করা নমুনা রক্তচাপের গ্রাফ"}>
    {[30, 68, 106, 144].map((line) => <line key={line} x1="24" y1={line} x2="576" y2={line} stroke="#edf0eb"/>)}
    {segments.map((segment, index) => <polyline key={index} points={segment.join(" ")} fill="none" stroke="#397b60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>)}
    {values.map((value, index) => value === null ? <circle key={index} cx={x(index)} cy="160" r="2" fill="#c2c9bf"/> : <circle key={index} cx={x(index)} cy={y(value)} r="3.5" fill="#fff" stroke="#397b60" strokeWidth="2"/>)}
  </svg>;
}

function averages(readings: DemoReading[]) {
  const glucose = readings.map((record) => record.glucoseMgDl).filter((value): value is number => value !== null);
  const systolic = readings.map((record) => record.systolic).filter((value): value is number => value !== null);
  const diastolic = readings.map((record) => record.diastolic).filter((value): value is number => value !== null);
  return {
    glucose: glucose.length ? mgdlToMmol(glucose.reduce((sum, value) => sum + value, 0) / glucose.length) : null,
    systolic: systolic.length ? systolic.reduce((sum, value) => sum + value, 0) / systolic.length : null,
    diastolic: diastolic.length ? diastolic.reduce((sum, value) => sum + value, 0) / diastolic.length : null,
    glucoseCount: glucose.length,
    pressureCount: Math.min(systolic.length, diastolic.length),
  };
}

export default function DoctorDemoPage() {
  const [view, setView] = useState<PortalView>("patients");
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [share, setShare] = useState<DemoSharePayload | null>(null);
  const [shareExpired, setShareExpired] = useState(false);
  const [search, setSearch] = useState("");
  const [metric, setMetric] = useState<Metric>("glucose");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(demoShareStorageKey);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (!isDemoSharePayload(parsed)) {
        sessionStorage.removeItem(demoShareStorageKey);
        return;
      }
      if (parsed.expiresAt <= Date.now()) {
        sessionStorage.removeItem(demoShareStorageKey);
        setShareExpired(true);
        return;
      }
      setShare(parsed);
      setActivePatientId(parsed.patientId);
      setView("shared");
    } catch {
      sessionStorage.removeItem(demoShareStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!share) return;
    const timer = window.setInterval(() => {
      if (share.expiresAt <= Date.now()) {
        sessionStorage.removeItem(demoShareStorageKey);
        setShare(null);
        setShareExpired(true);
        setView("patients");
        setActivePatientId(null);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [share]);

  const filteredPatients = useMemo(() => demoPatients.filter((patient) => {
    const matchesSearch = `${patient.name} ${patient.conditions.join(" ")}`.toLowerCase().includes(search.toLowerCase());
    const matchesView = view !== "shared" || patient.id === share?.patientId;
    return matchesSearch && matchesView;
  }), [search, share, view]);

  const activePatient = demoPatients.find((patient) => patient.id === activePatientId) ?? null;
  const canOpenActiveShare = !!share && activePatient?.id === share.patientId;

  function endDemoAccess() {
    try { sessionStorage.removeItem(demoShareStorageKey); } catch { /* no persistent access exists */ }
    setShare(null);
    setActivePatientId(null);
    setShareExpired(false);
    setView("patients");
  }

  function openPatient(patient: DemoPatient) {
    setActivePatientId(patient.id);
    setMetric("glucose");
  }

  return <div className="doctor-app" lang="bn">
    <aside className="doctor-sidebar">
      <Link className="doctor-brand" href="/"><span className="brand-mark">L</span><span>লাইফলুপ <small>কেয়ার টিম</small></span></Link>
      <div className="doctor-demo-label">ডেমো ওয়ার্কস্পেস</div>
      <nav className="doctor-nav" aria-label="ডাক্তার পোর্টাল মেনু">
        <button className={view === "patients" ? "active" : ""} onClick={() => { setView("patients"); setActivePatientId(null); }}><span className="doctor-nav-icon">▦</span>নমুনা রোগী</button>
        <button className={view === "shared" ? "active" : ""} onClick={() => { setView("shared"); setActivePatientId(share?.patientId ?? null); }}><span className="doctor-nav-icon">↗</span>শেয়ার করা তথ্য <span className="doctor-nav-count">{share ? "১" : "০"}</span></button>
      </nav>
      <div className="doctor-side-note"><strong>শুধু কাল্পনিক তথ্য</strong><p>এখানে কোনো বাস্তব রোগী, ক্লিনিক অ্যাকাউন্ট বা চিকিৎসা সিদ্ধান্ত নেই।</p></div>
      <div className="doctor-account"><span className="doctor-avatar">ন</span><span><strong>ডা. নাবিলা রহমান</strong><small>নমুনা চিকিৎসক</small></span></div>
      <Link href="/" className="patient-portal-link">রোগীর ডেমোতে ফিরুন <span>↗</span></Link>
    </aside>

    <main className="doctor-main">
      <header className="doctor-topbar"><div><span>লাইফলুপ ডেমো</span><b>/</b><strong>{activePatient ? activePatient.name : view === "shared" ? "শেয়ার করা তথ্য" : "নমুনা রোগী"}</strong></div><span className="doctor-online"><i/> ডেমো</span></header>
      <div className="doctor-content">
        <div className="doctor-demo-banner"><strong>ডেমো ওয়ার্কস্পেস</strong><span>সব রোগী ও রেকর্ড কাল্পনিক। এই পোর্টাল কোনো চিকিৎসা সেবা দেয় না।</span></div>
        {shareExpired && <div className="doctor-state-banner">ডেমো শেয়ারের সময় শেষ হয়েছে। নতুন কোনো স্বাস্থ্যতথ্য খোলা হয়নি।</div>}

        {activePatient ? <PatientReview patient={activePatient} readings={canOpenActiveShare ? share!.records : activePatient.readings} share={canOpenActiveShare ? share : null} metric={metric} setMetric={setMetric} onBack={() => { setActivePatientId(null); setView(share ? "shared" : "patients"); }} onEndShare={endDemoAccess}/> : <PatientRoster patients={filteredPatients} search={search} setSearch={setSearch} view={view} share={share} onOpen={openPatient} onViewChange={setView}/>}

        <footer className="doctor-footer">ডেমো ডেটা · কোনো তথ্য বাস্তব চিকিৎসকের কাছে পাঠানো হয় না</footer>
      </div>
    </main>
  </div>;
}

function PatientRoster({ patients, search, setSearch, view, share, onOpen, onViewChange }: { patients: DemoPatient[]; search: string; setSearch: (value: string) => void; view: PortalView; share: DemoSharePayload | null; onOpen: (patient: DemoPatient) => void; onViewChange: (view: PortalView) => void }) {
  const totalReadings = patients.reduce((sum, patient) => sum + patient.readings.length, 0);
  return <section className="doctor-page">
    {share && <article className="doctor-share-request"><div className="request-symbol">↗</div><div><span className="section-kicker">রোগীর ডেমো অনুরোধ</span><h2>রাফি আহমেদ তথ্য দেখার অনুমতি দিয়েছেন</h2><p>{share.period === "week" ? "শেষ ৭ দিনের নমুনা" : "সব নমুনা ইতিহাস"} · {[share.glucose && "রক্তে শর্করা", share.pressure && "রক্তচাপ"].filter(Boolean).join(" ও ")}</p></div><button className="doctor-primary-button" onClick={() => { const patient = demoPatients.find((item) => item.id === share.patientId); if (patient) onOpen(patient); }}>নমুনা সারাংশ খুলুন <span>→</span></button></article>}
    <div className="doctor-page-heading"><div><div className="section-kicker">রোগী ব্যবস্থাপনা ডেমো</div><h1>{view === "shared" ? "শেয়ার করা রেকর্ড" : "নমুনা রোগী"}</h1><p>রোগীর ধারাবাহিক তথ্য এক জায়গায় দেখানোর প্রোটোটাইপ</p></div><span className="doctor-date-tag">নমুনা ডেটা · অক্টোবর ২০২৬</span></div>
    <div className="doctor-stat-grid"><article><span>নমুনা রোগী</span><strong>{bn(patients.length, 0)}</strong><small>ডেমো তালিকায়</small></article><article><span>নমুনা রিডিং</span><strong>{bn(totalReadings, 0)}</strong><small>কেবল উদাহরণ</small></article><article><span>শেয়ার অনুরোধ</span><strong>{bn(share ? 1 : 0, 0)}</strong><small>{share ? "সিমুলেটেড" : "কোনো অনুরোধ নেই"}</small></article></div>
    <article className="doctor-panel doctor-roster-panel"><div className="roster-toolbar"><div><div className="section-kicker">কেয়ার টিম</div><h2>{view === "shared" ? "শেয়ার-সীমার রোগী" : "রোগীর তালিকা"}</h2></div><label className="doctor-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম বা অবস্থা দিয়ে খুঁজুন"/></label></div>
      <div className="doctor-filter-tabs"><button className={view === "patients" ? "active" : ""} onClick={() => onViewChange("patients")}>সব নমুনা</button><button className={view === "shared" ? "active" : ""} onClick={() => onViewChange("shared")}>শেয়ার করা</button></div>
      {patients.length ? <div className="doctor-patient-list">{patients.map((patient) => <button className="doctor-patient-row" key={patient.id} onClick={() => onOpen(patient)}><span className="doctor-patient-avatar">{patient.initials}</span><span className="doctor-patient-name"><strong>{patient.name}</strong><small>{patient.conditions.join(" · ")}</small></span><span className="doctor-patient-meta"><small>শেষ নমুনা রেকর্ড</small><strong>{patient.lastVisit}</strong></span><span className={`doctor-record-badge ${share?.patientId === patient.id ? "shared" : ""}`}>{share?.patientId === patient.id ? "শেয়ার করা ডেমো" : "নমুনা রেকর্ড"}</span><span className="doctor-row-arrow">→</span></button>)}</div> : <div className="doctor-empty"><strong>এই তালিকায় কোনো নমুনা নেই</strong><span>সব নমুনা রোগীর তালিকায় ফিরে যান।</span></div>}
    </article>
    <p className="doctor-boundary-note">তালিকার সংখ্যা এবং রেকর্ডগুলো নমুনা ডেটা থেকে গণনা করা। কোনো রোগীর অগ্রাধিকার, ঝুঁকি বা জরুরি অবস্থা নির্ধারণ করা হচ্ছে না।</p>
  </section>;
}

function PatientReview({ patient, readings, share, metric, setMetric, onBack, onEndShare }: { patient: DemoPatient; readings: DemoReading[]; share: DemoSharePayload | null; metric: Metric; setMetric: (metric: Metric) => void; onBack: () => void; onEndShare: () => void }) {
  const stats = averages(readings);
  const visibleGlucose = share ? share.glucose : true;
  const visiblePressure = share ? share.pressure : true;
  const hasMetric = metric === "glucose" ? visibleGlucose : visiblePressure;
  const validRecords = readings.filter((record) => metric === "glucose" ? record.glucoseMgDl !== null : record.systolic !== null);
  return <section className="doctor-page patient-review-page">
    <button className="doctor-back-button" onClick={onBack}>← রোগীর তালিকায় ফিরুন</button>
    <div className="doctor-patient-heading"><div className="doctor-patient-avatar large">{patient.initials}</div><div><div className="section-kicker">নমুনা রোগী · {patient.id.toUpperCase()}</div><h1>{patient.name}</h1><p>{patient.conditions.join(" · ")}</p></div><span className={`doctor-record-badge ${share ? "shared" : ""}`}>{share ? "রোগী-নির্বাচিত ডেমো সীমা" : "নমুনা রেকর্ড"}</span></div>
    {share && <div className="doctor-scope-banner"><span><strong>রোগী-নির্বাচিত ডেমো সীমা</strong><small>{share.period === "week" ? "শেষ ৭ দিনের নমুনা" : "সব নমুনা ইতিহাস"} · {[share.glucose && "শর্করা", share.pressure && "রক্তচাপ"].filter(Boolean).join(" ও ")}</small></span><span>শেষ হবে {new Intl.DateTimeFormat("bn-BD", { hour: "numeric", minute: "2-digit" }).format(new Date(share.expiresAt))}</span></div>}
    <div className="doctor-stat-grid patient-stats">{visibleGlucose && <article><span>গড় রক্তে শর্করা</span><strong>{stats.glucose === null ? "তথ্য নেই" : `${bn(stats.glucose)} mmol/L`}</strong><small>{bn(stats.glucoseCount, 0)}টি নমুনা</small></article>}{visiblePressure && <article><span>গড় রক্তচাপ</span><strong>{stats.systolic === null || stats.diastolic === null ? "তথ্য নেই" : `${bn(stats.systolic, 0)}/${bn(stats.diastolic, 0)} mmHg`}</strong><small>{bn(stats.pressureCount, 0)}টি নমুনা</small></article>}<article><span>দেখানো রেকর্ড</span><strong>{bn(readings.length, 0)}</strong><small>নমুনা সময়রেখা</small></article></div>
    <article className="doctor-panel doctor-chart-panel"><div className="roster-toolbar"><div><div className="section-kicker">সময়ের সঙ্গে</div><h2>রিডিংয়ের প্রবণতা</h2></div><div className="doctor-filter-tabs metric-tabs">{visibleGlucose && <button className={metric === "glucose" ? "active" : ""} onClick={() => setMetric("glucose")}>শর্করা</button>}{visiblePressure && <button className={metric === "pressure" ? "active" : ""} onClick={() => setMetric("pressure")}>রক্তচাপ</button>}</div></div>{hasMetric ? <><div className="doctor-chart-label">{metric === "glucose" ? "রক্তে শর্করা · mmol/L" : "সিস্টোলিক চাপ · mmHg"} <span>{bn(validRecords.length, 0)}টি রেকর্ড</span></div><PatientTrend readings={readings} metric={metric}/></> : <div className="doctor-empty"><strong>এই পরিমাপটি ভাগ করা হয়নি</strong><span>রোগীর নির্বাচিত সীমার বাইরে কোনো তথ্য দেখানো হচ্ছে না।</span></div>}</article>
    <article className="doctor-panel doctor-table-panel"><div className="roster-toolbar"><div><div className="section-kicker">মূল রেকর্ড</div><h2>তারিখ অনুযায়ী তালিকা</h2></div><span className="doctor-date-tag">উৎসসহ</span></div><div className="doctor-table-wrap"><table className="doctor-table"><thead><tr><th>তারিখ ও সময়</th>{visibleGlucose && <th>শর্করা</th>}{visiblePressure && <th>রক্তচাপ</th>}<th>তথ্যের উৎস</th></tr></thead><tbody>{readings.slice().reverse().map((record) => <tr key={record.id}><td><strong>{record.date}</strong><small>{record.time}</small></td>{visibleGlucose && <td>{record.glucoseMgDl === null ? "তথ্য নেই" : `${bn(mgdlToMmol(record.glucoseMgDl))} mmol/L`}</td>}{visiblePressure && <td>{record.systolic === null || record.diastolic === null ? "তথ্য নেই" : `${bn(record.systolic, 0)}/${bn(record.diastolic, 0)} mmHg`}</td>}<td><span className="doctor-source-dot"/>{sourceLabel(record.source)}</td></tr>)}</tbody></table></div></article>
    <div className="doctor-review-note"><strong>ডেমো সারাংশ</strong><p>এই সময়রেখা শুধু নমুনা রিডিং সাজিয়ে দেখায়। কোনো AI ঝুঁকি স্কোর, রোগ নির্ণয় বা চিকিৎসার পরামর্শ তৈরি করা হয়নি।</p></div>
    {share && <button className="doctor-end-access" onClick={onEndShare}>ডেমো অ্যাক্সেস শেষ করুন</button>}
  </section>;
}
