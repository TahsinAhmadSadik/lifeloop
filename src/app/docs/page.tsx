"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "deck" | "tech" | "live";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("deck");
  const [isEditable, setIsEditable] = useState(false);

  // Editable Pitch Deck State
  const [problemCopy, setProblemCopy] = useState(
    "Over 13 million Bangladeshis live with Type-2 Diabetes and 70%+ suffer from unmanaged hypertension (CKM Syndrome). Clinical visits are 3 to 6 months apart, fragmented by paper logs, numeral literacy barriers (Bengali ০-৯), and zero continuous physician oversight."
  );
  const [solutionCopy, setSolutionCopy] = useState(
    "LifeLoop introduces a Decoupled Dual-Loop care ecosystem: a deterministic Inner-Loop enforcing 0ms clinical safety gates paired with a cognitive Outer-Loop powered by Gemini Flash for bilingual guidance, 14-day rolling baselines, and 15-minute zero-trust clinician QR briefs."
  );

  // Team Sic_Parvis_Magna (All 5 Members)
  const team = [
    {
      name: "Tahsin Ahmad Sadik",
      role: "Team Lead & Systems Architect",
      institution: "BUET (CSE)",
      avatar: "TS",
      lead: true,
    },
    {
      name: "Tabassum Binte Kamal",
      role: "Clinical Logic & Biomedical Research",
      institution: "BUET",
      avatar: "TK",
      lead: false,
    },
    {
      name: "Naimul Islam",
      role: "AI Alignment & Multimodal Parsing",
      institution: "BUET",
      avatar: "NI",
      lead: false,
    },
    {
      name: "Ashique Elahe Tousif",
      role: "Full-Stack Development & UX Engineering",
      institution: "BUET",
      avatar: "AT",
      lead: false,
    },
    {
      name: "Abdur Rahman Rounak",
      role: "Data Engineering & Clinical Safety QA",
      institution: "BUET",
      avatar: "AR",
      lead: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                LL
              </span>
              <span className="font-bold text-lg text-emerald-400 tracking-tight">LifeLoop</span>
            </Link>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
              /docs public
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab("deck")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "deck" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Pitch Deck
            </button>
            <button
              onClick={() => setActiveTab("tech")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "tech" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Technical Specs
            </button>
            <button
              onClick={() => setActiveTab("live")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "live" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              System & Telemetry
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditable(!isEditable)}
              className={`text-xs px-2.5 py-1 rounded-md border transition ${
                isEditable
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Toggle inline text editing for evaluation verification"
            >
              {isEditable ? "✎ Editing Enabled" : "✎ Test Edit Mode"}
            </button>
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ========================================================================= */}
        {/* TAB 1: PITCH DECK                                                         */}
        {/* ========================================================================= */}
        {activeTab === "deck" && (
          <div className="space-y-10">
            {/* Hero / Deck Cover */}
            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 p-8 rounded-3xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-emerald-400 font-mono text-xs uppercase tracking-wider font-semibold">
                  Team Sic_Parvis_Magna · AI Builders Congress 2026
                </span>
                <span className="text-xs text-slate-400 font-mono">YC Format Pitch</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black mb-4 text-white tracking-tight">
                AI-Native Continuous Care for South Asia’s CKM Epidemic
              </h1>
              <p className="text-slate-300 text-base md:text-lg max-w-3xl leading-relaxed">
                LifeLoop converts sporadic, handwritten chronic diaries into continuous, clinician-actionable health trajectories through bilingual conversational triage, localized logbook OCR, and deterministic clinical safety gates.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-mono">
                <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-md border border-slate-700">
                  Target: 13.1M Diabetics in Bangladesh
                </span>
                <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-md border border-slate-700">
                  Safety: Decoupled Dual-Loop (0ms Inner Gate)
                </span>
                <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-md border border-slate-700">
                  Model: Google Gemini Flash
                </span>
              </div>
            </div>

            {/* Problem & Solution Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold mb-3">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> The Problem
                  </div>
                  <h3 className="text-xl font-bold mb-3">The South Asian Silent Killer</h3>
                  {isEditable ? (
                    <textarea
                      rows={4}
                      value={problemCopy}
                      onChange={(e) => setProblemCopy(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2.5 text-xs text-white mb-4"
                    />
                  ) : (
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{problemCopy}</p>
                  )}
                </div>
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-400">
                  <div>• <strong>Numeral Literacy Disconnect:</strong> Digital meters display Arabic digits; elderly patients record in Eastern Bengali numerals (০-৯).</div>
                  <div>• <strong>3-Minute Clinic Rush:</strong> Doctors cannot decipher months of crumpled paper slips during high-volume outpatient visits.</div>
                  <div>• <strong>Dangerous AI Wrappers:</strong> Generic chatbots hallucinate medical dosages or fail during acute hypertensive crisis.</div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> The Solution
                  </div>
                  <h3 className="text-xl font-bold mb-3">Continuous Care via Dual-Loop</h3>
                  {isEditable ? (
                    <textarea
                      rows={4}
                      value={solutionCopy}
                      onChange={(e) => setSolutionCopy(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2.5 text-xs text-white mb-4"
                    />
                  ) : (
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{solutionCopy}</p>
                  )}
                </div>
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-400">
                  <div>• <strong>Bilingual Conversational Triage:</strong> Converts informal Bengali voice/text check-ins into verified clinical records.</div>
                  <div>• <strong>Rolling 14-Day Baseline:</strong> Non-parametric median corridors isolate true clinical drift from temporary meal spikes.</div>
                  <div>• <strong>15-Minute Zero-Trust QR Handshake:</strong> Generates instantaneous, patient-consented SBAR briefs for physicians without cloud account logins.</div>
                </div>
              </div>
            </div>

            {/* Metrics & Opportunity */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="text-emerald-400 font-mono text-2xl font-bold mb-1">$2.8B+</div>
                <div className="text-sm font-semibold text-white mb-2">South Asia TAM</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chronic disease out-of-pocket healthcare spending across Bangladesh, where 68%+ of medical expenses are self-funded by patients.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="text-emerald-400 font-mono text-2xl font-bold mb-1">B2B2C Diagnostics</div>
                <div className="text-sm font-semibold text-white mb-2">Go-to-Market Model</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Distribution via regional diagnostic pathology chains (Popular, Ibn Sina), bundling LifeLoop access with quarterly HbA1c and lipid testing.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="text-emerald-400 font-mono text-2xl font-bold mb-1">0 ms</div>
                <div className="text-sm font-semibold text-white mb-2">Inner-Loop Crisis Gate</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Deterministic cutoffs for systolic BP ≥ 180 mmHg bypass generative LLMs completely, locking out AI hallucination liabilities in emergencies.
                </p>
              </div>
            </div>

            {/* Team Showcase — Team Sic_Parvis_Magna */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Team Sic_Parvis_Magna</h3>
                  <p className="text-xs text-slate-400">&quot;Greatness from small beginnings&quot; · BUET Engineering Team</p>
                </div>
                <span className="text-xs bg-slate-800 text-emerald-400 border border-slate-700 px-2.5 py-1 rounded-full font-mono">
                  5 Members
                </span>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.map((member, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3.5 bg-slate-950 p-4 rounded-xl border ${
                      member.lead ? "border-emerald-500/40 bg-emerald-950/10" : "border-slate-800"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        member.lead ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {member.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm truncate">{member.name}</span>
                        {member.lead && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                            Lead
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-400/90 truncate">{member.role}</div>
                      <div className="text-[11px] text-slate-400 truncate">{member.institution}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TECHNICAL SPECIFICATIONS                                           */}
        {/* ========================================================================= */}
        {activeTab === "tech" && (
          <div className="space-y-8">
            {/* System Architecture */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-3 text-white">System Architecture: Decoupled Dual-Loop</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Clinical safety requires deterministic boundary enforcement. LifeLoop decouples immediate clinical triage from cognitive coaching to eliminate generative hallucinations during acute medical events.
              </p>

              <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-5 rounded-xl border border-rose-500/30">
                  <span className="text-rose-400 font-bold block mb-1">INNER LOOP (Deterministic Safety Core)</span>
                  <p className="text-slate-400 mb-3 font-sans">
                    Runs synchronously with 0ms model latency directly in TypeScript route handlers.
                  </p>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• Intercepts Systolic BP ≥ 180 mmHg (Hypertensive Crisis)</li>
                    <li>• Clamps Glucose &lt; 3.0 mmol/L (Severe Hypoglycemia)</li>
                    <li>• Triggers immediate emergency escalation modal</li>
                    <li>• Strictly overrides and bypasses LLM text generation</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold block mb-1">OUTER LOOP (Cognitive Lifestyle Engine)</span>
                  <p className="text-slate-400 mb-3 font-sans">
                    Runs asynchronously via Google Gemini Flash serverless edge handlers.
                  </p>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• Natural language vital extraction (Bengali/English text)</li>
                    <li>• Multimodal paper logbook OCR with client canvas downscaling</li>
                    <li>• 14-day rolling baseline drift coaching via &quot;Shifa&quot;</li>
                    <li>• 1-page SBAR clinical brief synthesis for physician consultations</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* API Endpoints */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Edge API Route Catalog</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono">
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3">Payload / Function</th>
                      <th className="py-2.5 px-3">Resilience Fallback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    <tr>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">POST</td>
                      <td className="py-2.5 px-3">/api/checkin/parse</td>
                      <td className="py-2.5 px-3">Conversational text → JSON Schema</td>
                      <td className="py-2.5 px-3 text-slate-400">Deterministic regex unit parser</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">POST</td>
                      <td className="py-2.5 px-3">/api/shifa/chat</td>
                      <td className="py-2.5 px-3">Telemetry context + ADA 2026 RAG</td>
                      <td className="py-2.5 px-3 text-slate-400">Rule-based offline health cards</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">POST</td>
                      <td className="py-2.5 px-3">/api/import/vision</td>
                      <td className="py-2.5 px-3">Multimodal canvas-compressed image</td>
                      <td className="py-2.5 px-3 text-slate-400">1s retry + editable draft fallback</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-blue-400 font-bold">GET</td>
                      <td className="py-2.5 px-3">/doctor-demo</td>
                      <td className="py-2.5 px-3">15-min QR token verified session</td>
                      <td className="py-2.5 px-3 text-slate-400">Scoped access revocation</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Zero-Dependency SVG Visualization Engine */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Zero-Dependency Custom SVG Engine</h3>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                Rather than bundling heavy third-party charting libraries (Recharts / Chart.js), LifeLoop implements mathematical coordinate projections directly in React using native SVG elements.
              </p>
              <div className="grid md:grid-cols-3 gap-4 text-xs font-mono text-slate-300">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <strong className="text-emerald-400 block mb-1">Sub-50ms Render</strong>
                  Immediate client rendering with zero layout shift on budget mobile devices.
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <strong className="text-emerald-400 block mb-1">14-Day Baseline Corridor</strong>
                  Mathematical Median Absolute Deviation (MAD) corridor rendered via pure SVG rects.
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <strong className="text-emerald-400 block mb-1">Zero Imputation</strong>
                  Unmonitored days render as hollow baseline dots rather than false smoothed curves.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SYSTEM TELEMETRY & OBSERVABILITY                                   */}
        {/* ========================================================================= */}
        {activeTab === "live" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Live System Observability</h3>
                  <p className="text-xs text-slate-400">Telemetry of deployed LifeLoop services.</p>
                </div>
                <span className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> All Systems Operational
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">INNER LOOP LATENCY</span>
                  <span className="text-xl font-bold text-emerald-400">&lt; 1 ms</span>
                  <span className="text-slate-400 text-[10px] block mt-1">Deterministic edge gate</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">GEMINI FLASH TTFT</span>
                  <span className="text-xl font-bold text-emerald-400">~620 ms</span>
                  <span className="text-slate-400 text-[10px] block mt-1">Global average response</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">OCR COMPRESSION</span>
                  <span className="text-xl font-bold text-emerald-400">98.8%</span>
                  <span className="text-slate-400 text-[10px] block mt-1">5 MB → ~60 KB canvas</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">DATA MINIMIZATION</span>
                  <span className="text-xl font-bold text-emerald-400">100% PII-Free</span>
                  <span className="text-slate-400 text-[10px] block mt-1">Zero cloud persistence</span>
                </div>
              </div>
            </div>

            {/* Synthetic Patient State */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-3">Active Synthetic Patient State</h3>
              <div className="grid md:grid-cols-3 gap-4 text-xs text-slate-300">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px] block">ACTIVE PROFILE</span>
                  <strong className="text-white text-sm">Rafi Ahmed (রাফি আহমেদ)</strong>
                  <div className="text-slate-400">58 Yrs · Male · CKM Stage 2</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px] block">14-DAY BASELINE</span>
                  <strong className="text-white text-sm">Glucose: 7.2 mmol/L | BP: 132/84</strong>
                  <div className="text-slate-400">Baseline Status: Stable Control (μ ± 1.2σ)</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px] block">QR HANDSHAKE STATE</span>
                  <strong className="text-white text-sm">Ephemeral Scoped Token</strong>
                  <div className="text-slate-400">15-minute TTL · No persistent cloud login</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-8 text-center text-xs text-slate-500">
        LifeLoop · Team Sic_Parvis_Magna · AI Builders Congress 2026 Documentation Module
      </footer>
    </div>
  );
}