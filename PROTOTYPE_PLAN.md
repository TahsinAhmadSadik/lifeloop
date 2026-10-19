# LifeLoop product and prototype plan

## 1. Product decision

LifeLoop is a Bangla-first daily-care companion for adults managing Type 2 diabetes and hypertension. It brings together home glucose and blood-pressure readings, optional patient-approved activity and sleep context, a transparent view of personal patterns, practical daily routines, and patient-controlled sharing with a care team.

**Problem:** useful information is spread across home devices, phone or watch apps, notes, and memory. Patients have trouble seeing a coherent pattern; clinicians often lack a concise view of the period between visits.

**Product promise:** help a person record the measurements they already take, understand how their own pattern is changing, follow a manageable care routine, and prepare a useful conversation with a clinician.

**Boundary:** LifeLoop is not an emergency service, a diagnostic system, a medication manager, or a replacement for clinician judgment. A personal baseline describes what is usual for that person; it does not define what is medically safe.

## Current prototype inventory

Checked against the code on 19 October 2026. This section separates implemented interactions from mock data and future product work.

| Area | What exists now | What it does not yet do |
|---|---|---|
| Bengali patient interface | Responsive Bangla-first overview, glucose and BP cards, trend chart, recent-reading list, entry dialog, and brief-preview dialog | No accounts, persistent history, or device sync |
| Manual measurements | Entry form accepts Bengali or English numerals; glucose unit is selected; the shared helper converts glucose to canonical mg/dL and back for display; source labels distinguish sample, manual demo, and AI-draft demo | Glucose and both BP values share one entry timestamp; no fasting/post-meal context; height, weight and BMI capture are not yet in the UI; demo source is not device verification |
| Seeded history | Seven sample records drive the chart, averages and first-half versus second-half sample comparison | These are sample values, not patient data; refreshing resets newly entered values because they live in page state |
| Trend explanation | Bengali overview compares two halves of the current demo records and labels the comparison as sample-only | It is not a personal baseline or a validated trend engine. Do not present it as clinical detection or prediction |
| AI check-in | Server route and consent/review UI request a structured draft; values remain editable, missing fields stay blank, and every edit clears confirmation | Live parsing requires `GEMINI_API_KEY`. No live model result or Bangla extraction accuracy has been verified. No rate limiting/authentication for public exposure |
| AI photo importer | `/import` client, `POST /api/import/vision`, strict response validation, confidence review, recorded synthetic sample, explicit confirmation, and append-only tab-session timeline | Live Gemini call awaits the user's API key and a synthetic-fixture smoke test. Without a key the route returns 503; the recorded sample is never labelled live. No real patient data, photo persistence or OCR accuracy claim |
| Doctor portal and sharing | Separate `/doctor-demo` clinician workspace with three fictional patient fixtures, search, patient timelines, sample averages, source labels, and mobile layout. Patient demo can hand off a selected date range and glucose/BP scope through a 15-minute session-only demo record | No real QR scan, authentication, clinician identity verification, production consent enforcement, export, or data transmission. The QR-style image remains explicitly non-scannable |
| Daily routine | Session-only checklist for four demo actions, with derived completion progress | No persistence, personal clinical plan, reminder, adherence history or clinician-reviewed action library |
| Wearables and baseline | Synthetic baseline-learning view supports stable, gradual-change, noisy and missing-data scenarios; user can scrub the 28-day series and inspect five signals | No HealthKit/Health Connect integration, imported wearable data, patient-specific baseline, multimodal clinical model or clinical safety rules. Height/weight/BMI capture is not yet implemented |
| Deterministic demo engine (Steps 1–2) | Pure TypeScript trust scoring, causal robust baseline, upward CUSUM, explicit data-coverage states, fixed demo comparator, alert-budget calibration, BMI context helper, and seeded Rahim/Stable/Thin fixtures | Hypotheses and code behavior only; no clinical validation or engine UI yet. BMI never drives a state or alert |
| Shifa assistant | Bengali contextual chat panel with action chips, explicit question consent, deterministic answers from current demo records/routine, action buttons, and a limited-intent Gemini classifier at `/api/shifa/chat` when a server key is configured; keyword fallback otherwise | No unrestricted generative medical answers, no persistent conversation history, no clinician-side Shifa, and no validated intent-classification accuracy. Gemini receives the question for classification after consent; numeric record context is processed by the app route and is not forwarded to Gemini |

The unit and numeric helpers are in [`src/lib/health.ts`](./src/lib/health.ts). The parser endpoint is in [`src/app/api/checkin/parse/route.ts`](./src/app/api/checkin/parse/route.ts). The UI is in [`src/app/page.tsx`](./src/app/page.tsx). The project lint and production build passed after the parser and confirmation flow were added; that verifies the code compiles, not clinical behavior or live Gemini performance.

**Immediate product rule:** keep the existing screen as a usable demo, but label or replace any static copy before claiming that LifeLoop has learned a person's baseline, detected a sustained change, synchronized a watch, or shared a health record.

## 2. Product logic

```text
Patient entry or permitted device data
                 ↓
      Quality, source, unit and time checks
                 ↓
       Personal reference and pattern view
                 ↓
    Plain explanation and approved routine
                 ↓
       Patient chooses what to share
                 ↓
       Authenticated clinician timeline
```

The system must preserve the original reading, show where it came from, and say when information is missing or uncertain. A missing reading is **unknown**, never a reassuring result. The same rule applies when an AI service, wearable, or network connection is unavailable.

## 3. Data plan: start with two clinical measures, add useful context selectively

Wearable and phone-health data can be used when the user has a compatible source and grants permission. They are not universally available, and permission to read one type does not imply permission for another. Android Health Connect lists data types such as steps, sleep sessions, weight, resting heart rate, blood oxygen and skin temperature; Apple HealthKit also requires fine-grained permissions and may expose only a limited history window. See the [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types), [Apple HealthKit authorization guidance](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data), and [HealthKit overview](https://developer.apple.com/documentation/healthkit).

| Priority | Signal | Prototype use | Important limit |
|---|---|---|---|
| Core | Blood glucose from a suitable meter, entered by the patient or imported with permission | History, timing/context labels, patient-specific trend | Store unit, timestamp, source and context. Do not infer fasting or post-meal status when it was not provided. |
| Core | Blood pressure from a suitable upper-arm cuff | Repeated home readings, measurement-quality guidance and trend | A cuffless watch/phone estimate is not a substitute for a validated cuff. Technique and cuff fit affect the reading. |
| Optional context | Steps and activity duration | Show movement patterns and support a user-selected goal | Device estimates are incomplete; low steps do not prove inactivity. |
| Optional context | Sleep start/end, duration and regularity | Show broad sleep-pattern context alongside readings | Treat consumer-device sleep stages as estimates, not a clinical sleep assessment. A systematic review found meaningful differences between consumer devices and polysomnography for several sleep measures. |
| Optional context | Resting heart rate and weight | Longitudinal context when the user chooses to share it | Not a diabetes or hypertension diagnosis; device, medication, activity and other factors can affect values. |
| Optional body measures | Patient-confirmed height and repeated weight; BMI is calculated deterministically as kg/m² | Show height/weight provenance and BMI as a screening/context measure alongside the longitudinal record | No BMI category or alert in this demo. Missing/invalid height or weight means BMI is unavailable. BMI is not a diagnosis and cannot distinguish fat mass from lean mass. |
| Later, only with a defined use case | HRV, SpO₂, skin temperature, ECG, CGM and other streams | Research or an agreed care workflow | Each signal needs a source-specific quality and evidence assessment. Do not add signals only because a watch exposes them. |

The first wearable connection should use the platform health store, not a separate integration for every watch brand. Native HealthKit/Health Connect permission flows are not available to the current ordinary Next.js web page, so the existing web demo should use clearly labeled fixtures or an import simulation. Real synchronization is a later mobile/native integration decision.

**Recommended inclusion order:** glucose and BP first; then optional steps and sleep duration/regularity; then resting heart rate and weight if patient and clinician feedback show they help. Keep manual entry available for people without a smartwatch.

## 4. Personal baseline and pattern engine

### Baseline stages

1. **No baseline yet:** explain that there is not enough personal history; do not score the person as stable.
2. **Learning:** gather repeated, quality-checked readings. Show coverage and missing days. Avoid a confident personalized interpretation while the reference is weak.
3. **Usual-pattern reference:** estimate a robust center and spread per signal from comparable readings. Candidate methods include median and median absolute deviation, with short- and longer-window views. Candidate windows such as roughly two weeks and three months are engineering hypotheses to test, not clinical standards.
4. **Pattern under review:** when a sustained shift is detected, freeze or slow baseline adaptation so a gradual change is not silently absorbed as the new normal.

For the first engine implementation, keep baseline calculations causal: only use readings available before the current evaluation point. The synthetic Rahim shift begins on day 15, so a day 1–21 reference would leak part of the event into the baseline. Use days 1–14 as the initial warm-up reference, then evaluate day 15 onward. Height/weight-derived BMI may be calculated and shown alongside the series, but it does not contribute to this version's drift state or alert budget.

Separate contexts where they materially change interpretation. For example, a glucose value may be fasting, before a meal, after a meal, or unspecified; BP readings may be taken at different times or without the recommended resting procedure. Do not combine unlike contexts without saying so.

For the synthetic replay, the baseline is causal: the initial reference uses days 1–14 only, then the detector evaluates day 15 onward. Do not use days 15–21 to form a baseline for an event that begins on day 15. BMI is calculated from the height and weight values effective for that record, shown as context, and excluded from this version's CUSUM/alert state.

### Safe comparison logic

- Validate format, unit, timestamp, source, duplicate status and basic signal quality before analysis. Flag questionable data for review; do not silently delete the original.
- Calculate per-signal personal trends from the available history. The reference range is a description of this person’s recent pattern, not a treatment target.
- Keep any clinician-set target or safety rule separate from the personal baseline. Personalization must never expand a reference band in a way that normalizes a value outside a clinician-reviewed boundary.
- Prefer repeated, persistent change over one isolated measurement. Test whether concordant changes in independent signals add value; do not assume that more signals always improve the result.
- Use explicit states such as **Not enough data**, **Learning your pattern**, **Within your recent pattern**, and **Repeated change to review**. If direction is shown, say “higher/lower than your recent pattern,” not “your condition is getting worse/better.”
- Present the graph as a **Personal Pattern Profile** with separate tracks for glucose and BP, plus data coverage, trust and provenance. Do not collapse different measures into a single “Life Index” or risk score.
- Each explanation should name the period, measures and entries it used, report missingness, and give a non-diagnostic next step such as reviewing the trend with the care team.

### What “prediction” can honestly mean

For the demo, “learning” means illustrating how a personal reference is formed and how a repeated deviation appears in a timeline. Use synthetic or pre-seeded data and label it as a mechanism demonstration. Do not present a predicted diagnosis, future complication, or probability of deterioration.

A future predictive model requires a clinician-defined outcome, permitted and representative patient-level data, a pre-registered evaluation design, separation of training/tuning/test patients and time periods, external or local validation, calibration, and review of subgroup performance. Report sensitivity, specificity, positive predictive value, false alerts per patient-week and lead time where appropriate. Synthetic replay can test software behavior, not clinical validity.

### Demo alerts

The demo's “Repeated change to review” is a deterministic pattern flag, not a diagnosis, risk level, emergency signal or clinician page. Fixed-threshold flags use only values in `src/lib/engine/config.ts`, with an explicit “demo threshold; needs clinician review” label. BMI/weight can appear as context in a trend view, but do not trigger an alert on their own in this build. Missing data or an unready baseline always stays “Not enough data” or “Learning your pattern,” never “normal.”

The AI may explain the engine's computed facts in plain Bangla, explain terms from a reviewed glossary, and help prepare a patient-approved consultation brief. It must not tell the person their condition is worsening, forecast a specific complication, decide when they need care, or send a real doctor alert. The demo's doctor handoff is a patient-approved simulation only. The detailed R&D question and validation stages are in [`LIFELOOP_AI_PLAN.md`](./LIFELOOP_AI_PLAN.md).

## 5. Daily routine for diabetes and hypertension

The routine should reduce effort, not create a second job. The patient and, where available, their clinician select a small set of daily or weekly actions. Each action is optional unless it belongs to an agreed care plan.

**Routine components:**

- Record glucose at the times already agreed with the person’s care plan. Allow a simple context tag such as fasting, before meal, after meal, or “not sure.”
- Record home BP using a suitable cuff and clear measurement guidance. When the care plan calls for a series, support paired readings and show the recorded times. The American Heart Association recommends a validated upper-arm cuff, correct fit, quiet rest and repeated readings for home monitoring; the app should teach technique, not create an independent treatment schedule. See [AHA home blood-pressure monitoring](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home).
- Let users optionally log a meal pattern, activity, sleep, weight, symptoms or whether they followed their prescribed medication routine. Never ask them to change a dose or imply that a missed log means a missed dose.
- Offer short, culturally relevant lifestyle content reviewed by a qualified diabetes/hypertension professional. Content may support goals such as movement, meal planning, reducing excess salt, or breaking up long sedentary periods, but must be personalized for ability, preferences, comorbidities and clinician advice.
- Keep meal-photo estimates optional, correctable and clearly approximate. Do not use them as the sole basis for a health warning.
- Let people pause reminders, change goals, and see why a prompt appeared. Avoid shame, streak pressure, or alarm-red treatment of a missed check-in.

Start with a small reviewed content library and transparent rules. Do not add a bandit or adaptive coaching model until the team can define safe eligible actions, measure user benefit, and test that no coaching is issued when a clinician-defined concern needs review. The ADA’s 2026 standards emphasize individualized nutrition, physical activity and behavioral strategies; use them as a source for clinician-reviewed content, not as a one-size-fits-all prescription. See [ADA Standards of Care 2026, Section 5](https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932).

## 6. Doctor connection, QR and longitudinal records

The person may keep a long-term timeline, but **the QR code must not contain the health record**. It should contain only a short-lived, opaque pairing token. The suggested flow is:

1. Patient selects “Connect my doctor” and chooses the clinic or clinician, data categories, date range, and access duration.
2. LifeLoop creates a random, single-use QR pairing token that expires quickly. It contains no name, readings, diagnosis, account ID, or reusable access credential.
3. The clinician scans it while signed in to a verified clinician account. Scanning creates a request, not automatic access.
4. The patient reviews the named recipient and exact scope, then approves or declines. The patient can revoke access later.
5. The clinician sees only the approved scope in an authenticated workspace. Record access and sharing changes in an audit history.

The clinician view should make a lifetime record navigable rather than dumping every datapoint onto one screen:

- **Visit summary:** selected period, most recent values, averages/trends, number of readings, missing days, sources, and data-quality notes.
- **Longitudinal charts:** one metric at a time, with date filters and clear units; allow drill-down to the original reading and its context.
- **Routine/context:** optional activity, sleep and patient-entered routine notes shown separately from clinical measurements.
- **Provenance:** label patient-entered, device-imported, AI-parsed-and-confirmed, and clinician-entered records distinctly.
- **Sharing controls:** current access scope, expiry, revocation and access log.

Do not promise “lifetime” retention until retention, deletion, export, legal basis, hosting and backup policies have been agreed. A user should be able to understand what is stored, what is shared, and how to stop future sharing. HL7 FHIR’s [Consent resource](https://hl7.org/fhir/consent.html) is a useful interoperability reference, not a substitute for implementing authorization and consent enforcement.

## 7. AI role and data safeguards

- **Allowed in the prototype:** parse a short Bangla/Banglish check-in into proposed values and context; explain already-computed trends in plain Bangla; summarize selected records for a visit brief.
- **Required recheck:** show every extracted value and unit in an editable draft; leave missing/ambiguous values blank; patient confirms before saving; any edit clears confirmation. Keep manual input available.
- **Disallowed:** invent measurements, infer missing units, set medical thresholds, diagnose, predict emergencies, suppress deterministic safety rules, or change medication advice.
- **Evidence binding:** generated summaries may only use supplied computed fields and reviewed content. Validate every number and source reference; fall back to a deterministic template if validation fails.
- **Privacy:** ask before sending free text to an external AI service; minimize content; discourage identifiers; do not log raw check-ins; keep provider keys server-side; document retention and provider settings before real-patient use.

## 7A. Shifa, the Bengali-first LifeLoop assistant

### Product role

The assistant is named **শিফা (Shifa)** and introduced as **“লাইফলুপের সহকারী”**, not as a doctor, nurse, or medical expert. Its job is to help users understand and work with the demo: explain visible sample records, capture a proposed reading, guide a routine checklist, and prepare a shareable summary draft. In the clinician demo, it may summarize only the currently selected, approved sample scope. It must not act on records or send information by itself.

### Allowed actions and confirmation gates

| Action | What Shifa may do | Required gate |
|---|---|---|
| Explain visible data | Summarize a selected date range, units, sources, coverage and simple computed differences | Show the exact period and visible records used; state when data are missing; label synthetic output as sample data |
| Parse a Bangla/Banglish check-in | Use the existing parser to propose glucose/BP fields and context | Obtain consent before sending text; leave ambiguity blank; patient edits and confirms every value and unit before saving |
| Help with the routine | Show current checklist items or suggest a reviewed, optional item from the demo library | Never change a medical care plan; user explicitly adds or completes any item |
| Draft a doctor brief | Prepare a concise summary from the selected readings and approved share scope | Preview with the patient; no message, export or share until the patient separately confirms it |
| Explain the interface | Show how to enter readings, inspect a graph, or run the baseline demo | No health interpretation needed |

Shifa cannot diagnose, predict emergencies, recommend or change medication, decide whether a reading is safe, create clinical risk scores, rank the clinician caseload, or turn missing data into reassurance. If asked for those actions, it should briefly state the limit and direct the user to their care team. Any future urgent-symptom or emergency response must be a separate, clinician-reviewed deterministic flow, never improvised by chat generation.

### Bengali conversation design

- Default to natural, respectful Bangla in short sentences. Accept Bangla and Banglish input. Keep standard units and an English medical term in parentheses only when that improves clarity.
- Use supportive, non-judgmental language. Avoid alarmist or overconfident phrasing, shame, forced streaks, and claims that Shifa “knows” the user’s body.
- Make uncertainty explicit: “এই সময়ের নমুনা তথ্য থেকে এতটুকুই বোঝা যাচ্ছে” and “তথ্য কম, তাই তুলনা করা যাচ্ছে না.”
- When summarizing, show period, source and units beside the response. Link each numeric statement to a visible record or deterministic computed field.
- Do not answer general medical questions from model memory in the prototype. The first version is a product assistant grounded in the selected demo records and the reviewed routine library, not an unrestricted health chatbot.

### Aesthetic and interaction direction

Shifa should feel like a quiet part of LifeLoop, not a generic AI widget:

- Reuse the existing warm off-white canvas, restrained leaf green, soft borders and Bengali-first typography.
- Give the assistant a simple text-and-line identity: “শিফা” plus “লাইফলুপের সহকারী.” No emoji, AI sparkle, glowing gradients, or robot mascot.
- On desktop, open Shifa as a contextual side panel beside the current patient/dashboard view. On mobile, use a full-height sheet with a clear close/back action and a thumb-reachable composer.
- Start with three useful Bengali action chips: **“এই সময়ের রিডিং বুঝিয়ে বলুন”**, **“আজকের অভ্যাস দেখান”**, and **“ডাক্তারের জন্য সারাংশ তৈরি করুন”**. Available chips should depend on the current page and share scope.
- Separate conversation text from action cards. Drafts have a visible **“যাচাই করুন”** state; any saved change uses a separate explicit confirmation.
- Show a compact “যে তথ্য ব্যবহার হয়েছে” row with date range and signal/source labels. For sample data, keep a visible **“ডেমো তথ্য”** marker in the assistant response.
- Include simple states for thinking, unavailable AI, no data in scope, low confidence/ambiguity and network failure. The user can always continue with manual entry and the routine screen.

### Demo conversations

**Patient: “এই সপ্তাহে কী বদলেছে?”** Shifa compares the selected sample periods, names the glucose/BP values and units, notes missing entries, and says this is a simple sample comparison rather than a clinical interpretation.

**Patient: “ডাক্তারের জন্য একটা সারাংশ বানাও।”** Shifa opens a preview of the current share scope. The patient can edit or close it; Shifa does not transmit it.

**Clinician: “এই রোগীর গত ৭ দিনের তথ্য সংক্ষেপ করো।”** Shifa can only answer if the demo clinician view has that patient and range in scope. It returns measurements, data coverage and source labels, without a diagnosis, urgency rating or treatment recommendation.

### Technical action boundary

Treat Shifa as an orchestrator over a small allow-list, not an agent with unrestricted access:

1. The page provides only the current demo user/patient key, selected date window, authorized metric scope and deterministic computed summary.
2. Read actions return data; draft actions return a proposed reading, routine item or brief. The model never writes directly to the record.
3. The patient/clinician UI validates the draft, checks units and scope, and obtains explicit confirmation before a permitted local demo change.
4. Every numeric answer must map to a supplied record or computed field. If validation fails, use a fixed Bengali explanation or abstain.
5. If the model is unavailable, Shifa reports that and points to existing manual interactions. Deterministic charts, unit conversions and demo baseline calculations continue to work.

The current implementation follows this pattern in a limited form: Gemini classifies the user's consented question into an allow-listed intent; the server generates the answer and action from deterministic demo data. The client exposes action buttons that navigate to the existing entry, routine, learning or share flow. The numeric record list is not sent to Gemini. Without `GEMINI_API_KEY`, the endpoint uses a limited keyword classifier and marks the response as demo fallback. This is not yet a validated Bangla intent model or an open-ended AI conversation.

Use the existing canonical glucose conversion and Bengali-number parsing in [`src/lib/health.ts`](./src/lib/health.ts). Keep summarization inputs derived from the same selected records shown on screen. The doctor portal may never pass records outside the patient-approved demo scope. Before any real-user deployment, revisit privacy, regulatory and clinical review; this plan is for a synthetic prototype only.

### Shifa validation checklist

- At least a small reviewed Bangla/Banglish example set covers Bengali numerals, mixed units, missing or conflicting values and instruction-like text.
- Compare extracted fields and units exactly against the examples; ambiguous output must abstain or leave the field blank.
- Test that a patient edit clears confirmation, cancellation saves nothing, and model failure leaves manual entry available.
- Test question prompts against selected date range and scopes; Shifa must not reveal hidden metrics or other demo patients.
- Check every numeric statement against the visible source records and computed result.
- Have native Bangla speakers review tone, readability, ambiguity and culturally appropriate wording.
- Confirm the panel works at phone and desktop sizes and never looks like an emergency-monitoring service.

## 8. Prototype structure and staged scope

### Stage A: current web demonstration

The detailed competition-demo execution order, AI scope decisions and three-minute video sequence are maintained in [`LIFELOOP_AI_PLAN.md`](./LIFELOOP_AI_PLAN.md). Keep this product plan as the source for safety and product boundaries; use that file for the active demo build checklist.

1. **Implemented:** Bengali overview, glucose/BP charts, sample history, unit-aware manual entry and a demo visit summary. All entries remain in page state.
2. **Implemented:** sample-period comparison on the overview. Keep its wording explicitly sample-only; it does not learn a patient baseline.
3. **Implemented, key-dependent:** Bangla/Banglish AI draft route and confirmation flow. Next, configure the server-side key and evaluate extraction on a documented example set. Keep manual entry available. Do not expose the endpoint publicly before adding access/rate controls.
4. **Implemented:** session-only daily routine checklist. Next, get user and clinician feedback on the tasks before adding condition-specific routines or reminders.
5. **Implemented:** synthetic baseline-learning view with stable, gradual-change, noisy and missing-data scenarios. The deterministic engine core and Rahim/Stable/Thin fixtures are implemented and tested, but are not yet connected to this view. Next, build `/compare`. Do not call this a trained or clinical model.
6. **Implemented:** simulated QR handoff and clinician timeline. The QR-like image is intentionally not scannable and no record is transmitted. Real sharing requires identity, consent, authorization, storage, audit and revocation.
7. **Next:** connect the same seeded synthetic series to the fixed-threshold comparator and personal-pattern engine in `/compare`, clearly labelled as a mechanism demonstration with synthetic data.
8. **Implemented, demo scope:** Shifa contextual patient-side chat panel, Bengali action chips, question consent, limited-intent AI classification, deterministic evidence-based replies, and links to existing entry/routine/learning/share flows. Gemini mode requires a server-side key; otherwise the panel labels its keyword fallback. Remaining work: review Bangla phrasing, evaluate intent cases, and recheck every action against the safety and privacy boundaries in Section 7A. Do not add open-ended medical advice or imply that the clinician portal has a chatbot.

### Stage A2: separate clinician demo portal (implemented)

The separate clinician-facing workspace is implemented in the same Next.js project at `/doctor-demo`, with its own navigation, page header and responsive layout. It remains a **demo portal**, not a clinic system: all patients and readings are fictional, no account login is real, and no clinical action or message is sent.

#### Portal users and purpose

The demo clinician is a doctor or nurse reviewing patient-approved information between visits. The portal should answer three questions quickly:

1. Which demo patient and date range am I looking at?
2. What readings and routine information were actually shared, from which sources, and what is missing?
3. What changed in the displayed sample period that may be worth discussing at a visit?

It must not rank real patients by medical risk, issue diagnoses, provide treatment plans, or imply that a clinician has been paged.

#### Information architecture

**1. Clinician home / demo caseload**

- A narrow header marked **Demo clinician workspace** with a fictional clinician identity.
- Three seeded fictional patients, each with a neutral name/avatar, conditions in the demo profile, last sample-data date, coverage indicator and share status.
- Search and simple filters such as “All demo patients,” “Shared with me,” and “Sample pattern changed.” The last filter reflects the synthetic scenario only; it is not urgency or risk ranking.
- Summary counts are calculated from the fixtures, never hard-coded. Do not show an emergency queue, unread clinical alert count, or response-time promise.

**2. Patient review**

- Profile header with fictional name, demo ID, selected range and visible “Sample data” status.
- Glucose and BP cards with units, date/time, source label and coverage count. Display an unavailable state when a measure is not in the approved scope.
- Separate, selectable charts for glucose, BP and optional demo context such as steps/sleep. Do not combine units on a single axis.
- A chronological table that can be filtered by date and metric, and shows provenance (sample, patient-entered demo, or AI-draft confirmed demo).
- A compact visit brief generated from the shown records: period, reading count, averages, changes between selected periods, missing days and source notes. Explanatory text must be generated from those same values and labelled as a sample summary.
- A routine section shows only the session demo checklist and its completion count. It is not a treatment or adherence judgment.

**3. Share request / access state**

- If entered from the patient demo handoff, show the requested date range and metric scopes before opening the summary.
- The clinician view must not display a metric that was not included in the simulated patient approval.
- Include a visible demo token/status and an “End demo access” action that closes the simulated view and returns to the caseload.
- A direct visit to `/doctor-demo` opens the seeded demo caseload, not a real user's health record.

#### Patient-to-clinician demo handoff

Keep the handoff within the browser demo. The QR-like image remains explicitly non-scannable. Do not place health values, names, patient IDs or selected chart data in a URL, QR image or token. Use a short-lived demo token that references a session-only share record containing the selected scope and fictional record key. If session storage is used to cross the route boundary, store only synthetic demo data, clear the record when access ends, and clearly state that it is not production security.

Expected sequence: patient chooses the date range and data categories, sees the proposed scope, creates a demo request, then selects **Open clinician demo**. The portal displays only that approved scope. Ending access removes the simulated request. No real clinician scans a code and no data leaves the browser.

#### Implemented demo behavior

- Shared fictional patient fixtures live in `src/lib/demo-patients.ts` and reuse the canonical glucose conversions in `src/lib/health.ts`.
- `/doctor-demo` opens directly to a searchable fictional caseload; selecting a patient shows scoped readings, calculated averages, chart and source labels.
- The patient-side share simulation hands off a short-lived demo token and only the selected synthetic records/scopes through `sessionStorage`. No health details are placed in the route URL or token.
- The QR-style image is intentionally non-scannable. The patient clicks a simulation control to enter the doctor portal; the portal shows the approved demo scope and can end the session.
- The portal has explicit empty, expired and revoked states, and the production build succeeds with the new static `/doctor-demo` route.

#### Still out of scope

A real authenticated clinician portal, actual QR scanning, backend persistence, consent enforcement, audit infrastructure, EHR interoperability and real patient records require a separate security, privacy and clinical implementation plan. They are not implied by this demo portal.

#### Acceptance and rechecking criteria

- `/doctor-demo` loads directly and is clearly marked as a fictional demo workspace.
- The caseload has a small set of seeded fictional patients; every displayed count and trend derives from the fixture data.
- Selecting a patient opens a readable timeline, and changing the date range or shared metric scope changes the displayed data.
- Unshared metrics remain hidden in the simulated clinician view.
- The QR-like visual is labelled non-scannable; no health information is encoded in it or in the demo token/URL.
- Ending demo access returns to the caseload and clears the session-only share state.
- Missing or stale data are shown as missing/stale, never as normal or reassuring.
- No diagnostic label, clinical urgency score, medication advice, alert dispatch, or real-world monitoring claim appears in the portal.
- Desktop and phone layouts retain readable units, dates, provenance and scope status without horizontal page overflow.

### Stage B: usable product pilot foundation

- Select a mobile strategy and integrate Health Connect and/or HealthKit with separate, minimal permissions per data type.
- Add authenticated patient and clinician roles, secure storage, consent enforcement, access logs, deletion/export rules and rate limits before connecting any real health records.
- Validate source reconciliation, duplicate handling, sync gaps, timezone handling, changed permissions and revoked access.
- Review measurement instructions, routine content and any escalation protocol with a qualified local clinician before testing outside demo data.

### Stage C: clinical research, only if prerequisites are met

- Define the outcome with clinical partners, obtain required ethical/privacy approvals and data permissions, and pre-specify analysis.
- Compare the personal-trend method with a simple baseline on patient-separated data; report failures, calibration, false alerts and subgroup limits.
- Run usability testing before any supervised pilot. A pilot needs a partner, named alert ownership and an agreed response window; do not imply continuous monitoring without a staffed service.

**Do not build now:** new medical hardware, cuffless BP measurement, ECG interpretation, disease prediction, automated medication advice, full EHR integration, a multi-agent architecture, or a fully personalized learning/optimization engine.

## 9. Validation and rechecking matrix

| Area | What must be checked | Pass evidence before moving forward |
|---|---|---|
| Units and data integrity | Unit conversions, Bengali/English numerals, timestamps/time zones, source labels, duplicates, corrections, impossible formats | Deterministic tests and preserved original values; ambiguous records require correction rather than silent coercion |
| Measurement quality | BP technique/context, device/source, incomplete or conflicting readings | Quality flags are visible; uncertainty never becomes “normal” or “safe” |
| AI extraction | Bangla and Banglish, mixed units, commas/decimal formats, missing values, ambiguous phrasing, prompt-injection text | Per-field exactness and unit accuracy are reported; uncertain fields remain blank; nothing saves without patient confirmation |
| Personal baseline | Cold start, missing days, irregular sampling, noisy values, device changes, gradual drift, stable users | Baseline does not become available too early; an active sustained change is not absorbed; guardrails are reviewed by clinicians |
| Pattern engine | Single outlier, repeated change, two-signal concordance, one missing stream, stale wearable sync | Explainable states and computed evidence; compare against a fixed baseline; synthetic results are labeled synthetic |
| QR and clinician access | Expired/reused token, wrong clinic, declined request, revoked access, out-of-scope metric, unauthorized account | No PHI in QR; denied/expired/revoked links reveal no record; every grant and access is auditable |
| Daily routine | Time to complete, comprehension, burden, skipped days, diverse abilities and preferences | User feedback shows tasks are understandable, optionality is clear, and content is not mistaken for treatment advice |
| Reliability and privacy | LLM off, timeout, malformed output, network loss, permission removal, deletion request | Manual and deterministic paths still work; no raw check-in leakage; user sees what is unavailable |

Clinical model metrics should only be reported once labels and a valid evaluation cohort exist. Do not set a performance target from synthetic data and then present it as clinical evidence.

## 10. Demo story and claims

Demonstrate one person with a clinician-approved plan. The person reviews the two core measurements, sees optional watch context with its source and sync time, completes one manageable routine action, and opens a synthetic baseline-learning timeline. A repeated change is described as a pattern to review, not a predicted diagnosis. The patient starts a QR connection, approves a selected date range, and the clinician opens a compact summary and drills into the authorized timeline.

Say explicitly what is live, simulated, or future research. Do not claim that LifeLoop predicts heart attacks, forecasts complications, improves outcomes, automatically monitors emergencies, measures BP without a validated cuff, or has clinical validation. “Personal trend detection” is a prototype function; “condition prediction” is a future research question.

## 11. Evidence and implementation references

- Android health data availability and permission scope: [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types).
- Apple HealthKit permissions and limits on access to older data: [Authorizing access to health data](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data).
- Consumer sleep-stage measurement limitations: [systematic review comparing wearables with polysomnography](https://pubmed.ncbi.nlm.nih.gov/38557808/).
- Diabetes lifestyle and self-management content: [ADA Standards of Care 2026, Section 5](https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932).
- Home BP measurement and validated cuff technique: [American Heart Association home-monitoring guidance](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home).
- Patient consent vocabulary for future interoperability: [HL7 FHIR Consent](https://hl7.org/fhir/consent.html).
