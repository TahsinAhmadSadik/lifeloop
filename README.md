# LifeLoop

A patient-side health tracking prototype for people managing diabetes and hypertension. Built by **Team Sic Parvis Magna** for AI Congress (HealthSphere AI / ChronicCare AI), October 2026.

LifeLoop gives patients a single place to log blood glucose and blood pressure readings, track daily habits, explore how a personal baseline forms over time, and share a patient-approved summary with a clinician. The demo runs end-to-end in the browser using synthetic data and a live Gemini API integration on the server side.

> All records shown in the demo are synthetic. No real device, clinician, or health record is connected at any point.

---

## What it does

**Overview** — A personal health summary that shows the latest readings, a 7-day trend chart, and a plain-language comparison of two time periods using only the patient's own data.

**Daily routine** — A checklist of self-care habits (measurement, movement, meals, sleep) the patient marks off each session. Nothing is stored beyond the current browser session.

**Baseline demo** — An interactive simulator that lets you choose a synthetic scenario (steady, gradual change, noisy, or missing data), scrub through 28 days, and watch how a personal reference window forms from the first 14 days and how the engine describes the recent period relative to it.

**Clinician share** — A patient-controlled flow: choose which data categories to share, set a time window, generate a demo token, and simulate what a doctor would see after scanning the QR code. No data is transmitted to any external system.

**Shifa** — A Bangla-language assistant that explains what the displayed numbers mean, helps navigate the demo, and prepares a consultation brief for the patient to review. Shifa does not diagnose, predict complications, or write anything to the health record.

**Photo import** — A server-side Gemini request parses a synthetic diary photo into a structured JSON draft. The patient reviews and confirms every extracted field before it enters the session. The model never writes to the record directly.

---

## Engine design

The deterministic engine lives in `src/lib/engine/`. It is the only component allowed to compute states, update baselines, or trigger the CUSUM drift detector. A Gemini call may inform plain-language output but never changes engine state.

| Component | Purpose |
|---|---|
| `baseline.ts` | Builds a robust median / MAD reference from the first 14 days of confirmed readings |
| `cusum.ts` | Trust-weighted CUSUM drift detector per signal |
| `evaluate.ts` | Produces `PatientEngineResult` with states, baselines, and CUSUM output |
| `trust.ts` | Computes a per-reading trust score from source, OCR confidence, and measurement protocol |
| `body-metrics.ts` | Optional BMI context (patient-confirmed height and weight only) |
| `state.ts` | State names: `Not enough data`, `Learning your pattern`, `Within your recent pattern`, `Repeated change to review` |

Every AI step in the demo has a fixed input/output schema, a deterministic validator, a required patient confirmation, a recorded fallback, and a measured test. AI never sets a threshold, decides an alert, or gives medication guidance.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, vanilla CSS |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini API (server-side only) |
| Tests | Vitest 4 |

---

## Getting started

### Prerequisites

- Node.js 20 or later
- A Gemini API key (for the photo importer and Shifa; the rest of the demo works without it)

### Install

```bash
npm install
```

### Configure

Copy the example env file and add your key:

```bash
cp .env.example .env.local
```

```
GEMINI_API_KEY=your-server-side-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
```

The app runs in demo mode with recorded fallbacks when the key is absent or when the model is unreachable. Any response labelled `demo-fallback` in the UI was produced by the fallback path, not a live model call.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test

```bash
npm test
```

The test suite covers the deterministic engine (baseline, CUSUM, trust scoring) and the photo import schema validator.

---

## Project structure

```
src/
  app/
    page.tsx                  Main patient dashboard
    layout.tsx
    globals.css
    doctor-demo/              Clinician view rendered after QR simulation
    import/                   Photo import flow (client and server)
    api/
      checkin/parse/          Free-text check-in parser (Gemini, server-side)
      import/vision/          Diary photo importer (Gemini, server-side)
      shifa/chat/             Shifa assistant (Gemini, server-side)
  lib/
    engine/                   Deterministic baseline, CUSUM, trust, and evaluation
    health.ts                 Unit conversions (mmol/L, mg/dL, mmHg)
    demo-health.ts            Synthetic scenario generator and analyser
    demo-patients.ts          Seeded synthetic patient records (Rafi Ahmed)
    photo-import.ts           OCR draft schema and validator
```

---

## Claims boundary

| We may say | We do not say |
|---|---|
| A live Gemini prototype extracts proposed fields from a synthetic diary photo; the patient reviews before confirmation | Clinically validated |
| Compares a person with their own recent pattern | Predicts heart attacks, complications, or emergencies |
| Says "not enough data" instead of guessing | Diagnoses, or says a reading is safe or dangerous |
| Safety logic works with the model switched off | 24/7 monitoring |
| Simulator results are simulation, not clinical evidence | Any accuracy figure we did not measure |

The wording rule throughout the UI: say "higher than your recent pattern", never "worse" or "at risk".

---

## Scope

This repository contains the competition demo, not a production system. The following are explicitly out of scope for this release: user accounts, persistent storage, real device integrations, clinician authentication, automated alerts, clinical validation, and any deployment beyond a local or preview environment.

---

## Team

**Sic Parvis Magna** — AI Congress 2026, HealthSphere AI / ChronicCare AI track.
