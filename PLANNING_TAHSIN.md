# LifeLoop: PLANNING.md

Team Sic_Parvis_Magna | Track: ChronicCare AI | Submission due **31 Oct 2026** (concept paper + 3-min demo video + live demo link)
Written 12 Oct 2026. **19 days, 2 active builders (Dev A, Dev B).** This plan is sized for that, not for 5 people.

---

## 1. Goal

Ship a **believable, honest, reliable** demo of one deep loop, not a wide shallow stack.

> A Tier 1 patient (glucometer + BP cuff only) sends Bangla check-ins. LifeLoop detects sub-threshold multi-signal drift with far fewer alerts than a naive threshold monitor, escalates real emergencies deterministically, briefs the care team in one SBAR page, and learns which daily micro-action works for this patient.

Success = judges see the 5 demo moments below working, and every claim on screen survives cross-examination.

## 2. Demo contract (build backward from this)

| # | Moment (video + live) | Acceptance criterion |
|---|---|---|
| M1 | **Bangla check-in** (voice or text) for a Tier 1 patient | Reading parsed into structured values, confirmed back to the patient in Bangla. Fallback: typed input. |
| M2 | **Time-warp**: 3 weeks of telemetry replay in under 60 s | Patient moves normal, then drift, then compound warning. Baseline band and drift flag visible on chart. |
| M3 | **Alert counter, naive vs LifeLoop** on the same patient | Naive threshold monitor count vs LifeLoop count shown live (target shape: roughly 10+ vs 1 to 3). Numbers computed, never hard-coded. |
| M4 | **Deterministic escalation** (e.g., BP at or above 180/120 or glucose below 54 mg/dL) | Fires with the LLM disabled. Shows a simulated SMS/call log to family, CHW and clinic, labelled "simulated". |
| M5 | **SBAR brief + coaching card** | SBAR shows only computed numbers plus cited guideline chunks. Coaching card shows the micro-action and "why this one for you" from bandit history. |

If time runs short, **cut order (first to cut):** Capacitor wrapper, Web Speech voice input (keep typed), bandit sophistication (keep simple), extra patients. **Never cut:** M3, M4, the replay chart, the claim ladder slide.

## 3. Scope

**In:** Tier 1 data (glucose, BP; optional resting HR as Tier 2 field), rule table, dual-window baseline, fusion with alert budget, naive-vs-LifeLoop comparison, RAG over a small guideline set, SBAR generator, simple contextual bandit with safety constraints, CHW/clinician view, time-warp controller, one real-data replay chart, PWA install.

**Out (roadmap slide only):** learned cohort trajectory engine, true nocturnal dipping (Tier 3), CGM streaming, EHR integration beyond FHIR-shaped export, real SMS/call dispatch, iOS build, any claim of clinical efficacy.

## 4. Claim ladder (say this out loud in video and paper)

1. **Established:** clinical components come from guidelines and trials (ADA, AHA/ACC, KDIGO, WHO HEARTS).
2. **Real-data replay:** glucose baseline, variability and signal-quality logic tested on open data vs a naive threshold.
3. **Synthetic composition:** full pipeline on synthetic patients, with a **held-out generator** not used for tuning. Mechanism demo, **not clinical validation**.

Never say: "predicts days ahead", "reduces readmissions", "clinically validated". Say: "hypothesis the pilot will test".

## 5. Architecture decisions and why

| Decision | Reason |
|---|---|
| **TypeScript monorepo; core engine is a pure package with zero LLM imports** | It is the safety case, runs in browser (time-warp) and server, and is unit-testable. |
| Inner loop = versioned rule table in `packages/core`, each rule has `guidelineRef` | Explainability, fail-safe escalation. |
| LLM (Gemini Flash) used only for: Bangla check-in parsing, SBAR narration, coaching text | Keeps hallucination surface small. |
| LLM never computes or invents numbers; all values come from a features JSON | Hard guardrail, verified by a post-check. |
| Structured output (zod schema) instead of free text; citations must reference retrieved chunk IDs or feature keys | Verifiable. Unsupported sentences are dropped, and low retrieval confidence means abstain. |
| LangChain JS **optional**; default to `@google/genai` or Vercel AI SDK + zod | Fewer moving parts. Use LangChain only if a teammate already knows it. |
| Supabase: Postgres, pgvector, RLS, Auth | Guideline RAG, patient data, audit log. |
| Glucose stored in **mg/dL**, displayed in **mmol/L** for Bangladesh (divide by 18.016) | Bangladeshi devices and clinicians commonly use mmol/L. Unit bugs are a classic failure. |
| Time-warp runs client-side from precomputed or generated series, calling core engine | Deterministic, fast, no network risk in the live demo. |
| PWA first, Capacitor Android only if ahead of schedule | Honest framing: "PWA live; Android build via Capacitor, demo-grade". |
| Python allowed only in `notebooks/` for replay | Everything shipped is TypeScript. |

### Engine spec (packages/core)

- **Baseline:** per stream, log-transform glucose; median and MAD over a 14-day window (acute) and 90-day anchor (slow drift). Freeze baseline updates while a drift flag is open. Clinician guardrail ranges cap how far the baseline can drift.
- **Cold start:** days 1 to 14 use shrinkage toward literature priors; UI shows "baseline still learning"; only the inner loop acts.
- **Drift features:** robust z-score, slope, persistence (days), glucose CV, morning-minus-evening BP gap (non-dipping **proxy**, labelled as proxy), resting HR delta if present.
- **Fusion (escalate only if all hold):** at least 2 independent streams deviate in concordant direction; persists at least k days (default 3); risk score above threshold; per-patient alert budget not exhausted (default 1 non-urgent per week, extras go to the weekly digest).
- **Risk score v1:** transparent weighted logistic from literature-derived weights, **no learned cohort engine**. Output wording: "pattern consistent with higher-risk trajectories", never causal.
- **Signal quality gate:** reject physiologically implausible values, flag likely entry errors, require confirmation.
- **Naive monitor (for M3):** fixed single-vital thresholds, one alert per breach.
- **Bandit:** small action set (6 to 10 micro-actions), Thompson sampling or epsilon-greedy, reward = adherence plus next-day delta in the relevant measure. **Hard constraints:** no action when an inner-loop flag is open, actions limited to a vetted lifestyle list, never medication changes.

### Inner-loop starter rules (configurable, `guidelineRef` required; clinician must review before any real use)

| Rule | Condition | Tier |
|---|---|---|
| HYPO_L2 | glucose < 54 mg/dL | Emergency |
| HYPO_L1 | glucose < 70 mg/dL | Urgent, self-treat guidance |
| BP_CRISIS | SBP >= 180 or DBP >= 120 | Emergency if symptoms, else urgent recheck |
| HYPER_SUSTAINED | glucose > 300 mg/dL on 2 consecutive readings (configurable) | Urgent |
| MISSED_CHECKINS | no data for n days | Nudge family or CHW |

## 6. Data model (Supabase)

`patients`, `readings` (patient_id, ts, stream, value, unit, source, quality_flag), `baselines` (snapshot, window, frozen flag), `alerts` (type: naive | lifeloop | inner, tier, reason, features_json), `escalations` (simulated dispatch log), `sbar_briefs` (features_json, chunk_ids, text, verifier_result), `coaching_actions` (catalog), `coaching_events` (patient, action, adherence, outcome delta), `guideline_chunks` (text, source, section, embedding vector), `audit_log` (inputs, retrieved ids, model, output). **RLS on every patient table.**

## 7. Real-data replay protocol (small, runs in parallel)

- **Question:** does our dual-window robust baseline plus persistence gating produce fewer non-actionable flags than a fixed-threshold monitor on real glucose data, without losing true excursions?
- **Data:** CGMacros (PhysioNet). Request access to AI-READI on day 0 as a stretch; do not depend on it.
- **Method:** downsample CGM to 3 to 4 glucometer-like readings per day to mimic Tier 1; run naive vs LifeLoop; report alerts per patient-week, excursions caught (e.g., <54, >250 mg/dL events) and robustness to injected sensor noise.
- **Output:** one chart and 3 numbers for the paper, video and `docs/replay.md`. State the limits: small cohort, no BP, no outcome labels.
- **Budget:** at most 1.5 days of Dev A. Notebook, not product code.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Gemini Bangla quality or rate limits | Test on day 1. Cache responses for demo patients. Keep a typed fallback. |
| Live demo failure | Pre-seeded patients, cached LLM outputs, record the backup video early, keep Supabase warm. |
| Circularity attack | Held-out generator; replay on real data; "mechanism demo" wording. |
| Scope creep | Cut order in section 2. Feature freeze 27 Oct. |
| Unit and locale errors (mg/dL vs mmol/L) | Single conversion helper plus tests. |
| Only 2 builders | Strict ownership (section 9); short daily sync; PR-sized tasks. |
| Unverified statistics in paper | Verify before 27 Oct. Remove † placeholders. |

## 9. Roles and timeline

**Dev A (engine, data, LLM):** `packages/core`, generators, Supabase and RAG, outer loop, replay notebook.
**Dev B (product, demo, story):** `apps/web`, time-warp UI, views, PWA, deployment, video, paper polish.
(Swap names as you like; keep the split. The other 3 members can verify stats, review the paper, test Bangla text and write the video script.)

| Dates | Dev A | Dev B |
|---|---|---|
| **12-13 Oct** | Repo, types, unit helpers, Gemini Bangla test, data-access requests | Demo contract and script draft, app shell, deploy hello-world, mock data |
| **14-17 Oct** | Rule table, baseline, fusion, naive monitor, tests. Generators (tune + held-out) | Chart components, time-warp controller on mock data, patient view |
| **18-21 Oct** | Supabase schema, RLS, guideline ingestion, outer loop, SBAR verifier | CHW/clinician view, SBAR UI, alert counter (M3), escalation log (M4) |
| **22-24 Oct** | Bandit, replay notebook, integrate engine into app | Coaching card (M5), check-in flow (M1), full end-to-end pass |
| **25-26 Oct** | Red-team set, replay chart, fixes | PWA, polish, Capacitor **only if ahead**, deploy production |
| **27 Oct** | **FEATURE FREEZE.** Bug fixes only | Concept paper final (stats verified), export PDF |
| **28-29 Oct** | Support, fix blockers | Record video (backup first), rehearse live link |
| **30 Oct** | Submit with a full day of buffer | |
| **31 Oct** | Deadline day: emergency only | |

## 10. Submission checklist

- [ ] Concept paper: † stats verified, PDF exported, claim ladder matches video
- [ ] 3-min video: M1 to M5 in order, ladder said out loud, "simulated dispatch" visible, backup recording saved
- [ ] Live link loads on mobile and desktop, seeded patients ready, Supabase awake
- [ ] `docs/replay.md` with chart and limits
- [ ] README with architecture diagram, safety guardrails, and roadmap (cohort engine, Tier 3, Capacitor, regulatory path)
- [ ] Prompt library included (competition scores it): Bangla parsing, SBAR, coaching, verifier, red-team prompts, versioned in `/prompts`
- [ ] Data lifecycle diagram (collection, minimization, storage, de-identification, retention, deletion), since it carries 25 points
