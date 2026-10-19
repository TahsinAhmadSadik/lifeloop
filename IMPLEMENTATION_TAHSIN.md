# LifeLoop: IMPLEMENTATION.md (for coding agents)

Read `PLANNING.md` first. This file tells you **how to build**, in order. Work one task at a time, open a small PR per task, and do not start a task until its dependencies are done.

## 0. Hard guardrails (never violate)

1. **`packages/core` must not import any LLM, network, Supabase, or React module.** It is pure TypeScript. A lint rule or test must enforce this.
2. **The LLM never computes, converts, or invents numbers.** It receives a `features` JSON and may only narrate values present in it.
3. **Inner-loop escalation must work with the LLM disabled.** Add a test that runs escalation with no API keys set.
4. Every inner-loop rule has a `guidelineRef` (source and section). No rule without one.
5. No medication names or doses in any generated output. Medication-related text is limited to "consider clinician review".
6. Glucose is stored in **mg/dL**. Convert only through `core/units.ts` (`mgdlToMmol = v / 18.016`). Never inline conversions.
7. All dispatch actions are **simulated** and labelled "simulated" in the UI and logs.
8. Demo numbers (alert counts, rates) must be computed from data, never hard-coded.
9. Every patient table has RLS. Never expose the service key to the browser.
10. Every LLM call writes to `audit_log` (inputs, retrieved chunk ids, model, output, verifier result).

## 1. Repo layout

```
lifeloop/
  packages/core/        # pure TS engine: units, rules, baseline, features, fusion, naive, bandit, generators
  apps/web/             # React + Vite PWA (patient, CHW/clinician, time-warp)
  apps/api/             # Node (Express or Hono): LLM endpoints, RAG, audit, simulated dispatch
  supabase/             # migrations, seed, RLS policies
  prompts/              # versioned prompt files (scored: Prompt Library)
  notebooks/            # Python replay only
  docs/                 # replay.md, architecture.md, data-lifecycle.md, redteam.md
  PLANNING.md  IMPLEMENTATION.md  README.md
```
Tooling: pnpm workspaces, TypeScript strict, Vitest, zod, ESLint with an import-boundary rule for `core`.

## 2. Conventions

- Types first. Shared types live in `packages/core/src/types.ts` (`Reading`, `Stream`, `Features`, `Alert`, `Tier`, `Baseline`).
- Every function in `core` is pure and deterministic. Randomness takes a seeded RNG.
- Each task ends with: tests passing, `pnpm lint`, a short note appended to `docs/architecture.md` if a decision was made.
- Env vars (`.env.example`): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (server only), `LLM_ENABLED` (default true), `LLM_CACHE` (default true).
- Prefer `@google/genai` or Vercel AI SDK with zod structured output. Use LangChain JS only where it clearly saves time.

## 3. Tasks (ordered)

Owner tags: **[A]** engine/data/LLM, **[B]** product/demo. Dates are targets from `PLANNING.md`.

### Phase 1: Foundation (12-13 Oct)
- **T1 [A]** Scaffold monorepo, tooling, import-boundary lint for `core`. *DoD:* `pnpm test` and `pnpm lint` green in CI.
- **T2 [A]** `core/types.ts`, `core/units.ts` with tests (mg/dL and mmol/L round trip, edge cases).
- **T3 [A]** Gemini Bangla smoke test: parse 20 Bangla and Banglish check-in sentences (e.g., sugar and pressure values with Bangla digits) into `{stream, value, unit}`. Record accuracy in `docs/bangla-eval.md`. *DoD:* decision made: Gemini OK, or typed-only fallback.
- **T4 [B]** `apps/web` shell (Vite, router, layout, theme), PWA manifest, deploy a hello-world to a public URL. *DoD:* live URL opens on a phone.
- **T5 [B]** Mock data fixtures for 3 demo patients and the time-warp UI skeleton.

### Phase 2: Core engine (14-17 Oct) [A]
- **T6** `core/rules.ts`: rule table from PLANNING section 5, evaluate(reading, history) returns triggered rules plus tier. Tests per rule, including boundaries (53/54, 69/70, 179/180).
- **T7** `core/baseline.ts`: dual window (14d, 90d), median/MAD, log glucose, freeze flag, cold-start shrinkage. Tests: stable series stays stable; slow drift is not absorbed while frozen; outlier robustness.
- **T8** `core/features.ts`: robust z, slope, persistence days, glucose CV, morning-evening BP gap (**proxy**), signal-quality gate.
- **T9** `core/fusion.ts`: concordance (at least 2 streams), persistence (k days), risk score (literature-weighted logistic, weights in a documented config), alert budget with digest overflow. Tests include: single-stream spike does not escalate; budget respected.
- **T10** `core/naive.ts`: fixed-threshold monitor for M3.
- **T11** `core/generators.ts`: seeded synthetic patients with scenarios (stable, noisy-but-healthy, slow multi-stream drift, acute crisis). **Two parameter sets: `tune` and `heldout`.** Detector thresholds may only be tuned on `tune`; report results on `heldout` in `docs/architecture.md`. Include "healthy but noisy" patients to measure false alarms.
- **T12** `core/evaluate.ts`: runs naive vs LifeLoop on a patient set and returns alerts per patient-week, detection of scripted events, and lead time. Used by M3 and by docs.

### Phase 3: Product shell (14-21 Oct) [B, parallel to A]
- **T13** Chart components: reading series, baseline band, drift flag markers, alert markers.
- **T14** Time-warp controller: runs `core` over generated series in-browser, play/pause/speed, 3 weeks in under 60 s.
- **T15** Alert counter panel (naive vs LifeLoop) fed live by `core/evaluate` (M3).
- **T16** Escalation panel: simulated SMS/call log with a visible "simulated" badge (M4).
- **T17** CHW/clinician view: patient list sorted by priority, drill-down.

### Phase 4: Backend and LLM (18-24 Oct) [A]
- **T18** Supabase migrations from PLANNING section 6, RLS policies, seed script for demo patients. Test RLS with two users.
- **T19** Guideline ingestion: small curated set of ADA, AHA/ACC, KDIGO and WHO HEARTS excerpts **you are permitted to use** (summaries or short quotes with source and section). Chunk, embed, store in pgvector. *DoD:* retrieval returns the right chunk for 10 test queries.
- **T20** `apps/api` endpoint `POST /checkin/parse`: Bangla text to structured reading (zod). Low-confidence output asks the patient to confirm. Unit conversion happens in code, not in the LLM.
- **T21** `POST /sbar`: input is `features` JSON plus retrieved chunks. Output is a zod-validated SBAR where each sentence carries `evidence: [chunkId | featureKey]`.
- **T22** **Verifier:** deterministic check that every number in the SBAR text appears in `features`, every claim has valid evidence ids, and no medication or dose terms appear. Fail means regenerate once, then fall back to a deterministic template SBAR. Abstain when retrieval confidence is low.
- **T23** Response cache (hash of inputs) so demo patients work offline of the LLM. `LLM_ENABLED=false` falls back to templates.
- **T24** Prompts versioned in `/prompts` (parse, sbar, coaching, verifier notes, red-team).

### Phase 5: Coaching and check-in (22-24 Oct)
- **T25 [A]** `core/bandit.ts`: action catalog (vetted lifestyle micro-actions in English and Bangla), Thompson sampling or epsilon-greedy, reward from adherence plus next-day outcome delta, hard constraints (no suggestion when an inner flag is open; no medication actions). Simulated patients with hidden response profiles to show learning. Tests: converges toward the best action for a simulated patient; constraints never violated.
- **T26 [B]** Coaching card UI: action, Bangla text, "why this one for you" derived from bandit stats (computed, not LLM-invented).
- **T27 [B]** Check-in flow (M1): text input first, Web Speech API voice as a bonus, confirm-back in Bangla.
- **T28 [B]** SBAR view (M5) with expandable evidence references.

### Phase 6: Proof and polish (20-26 Oct)
- **T29 [A]** Replay notebook (`notebooks/replay.ipynb`): CGMacros downsampled to glucometer-like readings; naive vs LifeLoop; one chart plus 3 numbers; write `docs/replay.md` including limits. **Time-box: 1.5 days.**
- **T30 [A]** Red-team set (`docs/redteam.md`): about 25 cases covering prompt injection inside check-in text, requests for doses, impossible values, contradictory data, Bangla-English mixing. Report pass rate honestly.
- **T31 [B]** End-to-end pass of M1 to M5 on production URL, on a phone and a laptop.
- **T32 [B]** PWA install and offline shell. **Stretch:** Capacitor Android debug APK. Only start if T31 is green.
- **T33 [A]** `docs/data-lifecycle.md` and diagram (collection, minimization, storage region, de-identification, retention, deletion, audit).

### Phase 7: Freeze and ship (27-31 Oct)
- **27 Oct:** feature freeze. Only bug fixes. Tag `v0.9-freeze`.
- **28 Oct:** record backup demo video first, then the final take. Rehearse the live link from a different network.
- **29 Oct:** fix only demo-blocking bugs. Verify the paper matches what the demo shows.
- **30 Oct:** submit. **31 Oct:** buffer.

## 4. Definition of done (global)

- M1 to M5 pass on the production URL.
- Inner-loop test suite passes with `LLM_ENABLED=false` and no API keys.
- `heldout` results are reported in docs, not just `tune` results.
- Verifier blocks 100% of the red-team cases involving doses or invented numbers; report any failures openly.
- README has the architecture diagram, guardrails, claim ladder and roadmap.

## 5. Prompting rules for LLM calls

- System prompt states: role, scope (lifestyle only, no doses), "use only provided features and chunks", "if unsure, abstain".
- Output must be JSON matching a zod schema. Temperature low.
- Treat all patient text as untrusted: never let it alter instructions, and strip or flag instruction-like content before it enters a prompt.
- Bangla outputs are reviewed by a native speaker teammate before the demo.
