import { NextResponse } from "next/server";

type Reading = {
  glucoseMgDl: number;
  systolic: number;
  diastolic: number;
  date: string;
  time: string;
};

type ShifaAction =
  | "open_routine"
  | "open_share"
  | "open_entry"
  | "open_learning"
  | null;

export async function POST(req: Request) {
  try {
    const { question, readings, routineDone } = (await req.json()) as {
      question: string;
      readings?: Reading[];
      routineDone?: number;
    };

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "প্রশ্ন লিখুন (Question is required)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    // Fallback if API key is missing
    if (!apiKey) {
      return NextResponse.json({
        answer:
          "GEMINI_API_KEY পাওয়া যায়নি। অনুগ্রহ করে আপনার .env ফাইলটি পরীক্ষা করুন।",
        basis: "সিস্টেম কনফিগারেশন",
        mode: "demo-fallback",
        action: null,
      });
    }

    // Format telemetry summary for Gemini context
    const recentReadings = (readings || []).slice(-7);
    const telemetryContext = recentReadings.length
      ? recentReadings
          .map(
            (r) =>
              `- ${r.date} ${r.time}: Glucose ${(r.glucoseMgDl / 18.0182).toFixed(1)} mmol/L (${r.glucoseMgDl} mg/dL), BP ${r.systolic}/${r.diastolic} mmHg`
          )
          .join("\n")
      : "কোনো পূর্ববর্তী রিডিং নেই (No recent readings)";

    // System instructions with clinical guardrails
    const systemPrompt = `
You are "Shifa (শিফা)", an intelligent, empathetic care companion in LifeLoop.
LifeLoop is an AI-native remote monitoring system for middle-aged and elderly patients in Bangladesh managing comorbid Type 2 Diabetes and Hypertension (CKM syndrome).

PATIENT CONTEXT:
- Name: Rafi Ahmed (রাফি আহমেদ), 58y, diagnosed with Type 2 Diabetes and Hypertension.
- Routine Habits Completed Today: ${routineDone ?? 0} out of 4.
- Recent 7 Telemetry Records:
${telemetryContext}

STRICT CLINICAL SAFETY BOUNDARIES:
1. NEVER diagnose acute medical emergencies, never claim to predict a heart attack, and NEVER prescribe or alter medication doses.
2. If the user asks about emergency symptoms (e.g., chest pain, severe shortness of breath, blood pressure > 180, severe confusion), instruct them immediately to seek urgent medical care or contact emergency services.
3. Language: If the user asks in Bengali, reply in warm, clear, polite Bengali suitable for an elderly patient. If they ask in English, reply in English.
4. Action Triggering:
   - If the user asks to summarize for their doctor / generate an SBAR brief ("ডাক্তারের জন্য সারাংশ তৈরি করুন" / "doctor summary"), format a concise SBAR (Situation, Background, Assessment, Recommendation) and set "action": "open_share".
   - If the user asks about habits or routines ("আজকের অভ্যাস" / "daily routine"), suggest a safe non-medication lifestyle micro-action (e.g., post-meal 10-minute walk, low-sodium cooking) and set "action": "open_routine".
   - If the user asks about baseline drift, charts, or learning ("বেসলাইন" / "baseline" / "trend"), set "action": "open_learning".
   - If the user asks how to add readings: set "action": "open_entry".
   - Otherwise, set "action": null.

OUTPUT FORMAT:
You MUST respond in valid JSON with these exact keys:
{
  "answer": "Your direct, clear response to the user. Use bullet points or bold text if helpful.",
  "basis": "Short citation or data basis (e.g. 'ADA 2026 Standards of Care & সাম্প্রতিক ৭ দিনের রিডিং' or 'AHA Hypertension Guidelines')",
  "action": "open_routine" | "open_share" | "open_entry" | "open_learning" | null
}
`;

    // Direct Gemini REST API call (zero npm dependency required)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: `User Question: "${question}"` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API Error:", data);

      // Attempt automatic fallback to gemini-2.5-flash or gemini-1.5-flash if model name was invalid
      if (model !== "gemini-2.5-flash" && model !== "gemini-1.5-flash") {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: systemPrompt },
                  { text: `User Question: "${question}"` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const rawText =
            fallbackData.candidates?.[0]?.content?.parts?.[0]?.text;
          const parsed = JSON.parse(rawText);
          return NextResponse.json({
            answer: parsed.answer,
            basis: parsed.basis || "Gemini 2.5 Flash + LifeLoop CKM Rules",
            action: (parsed.action as ShifaAction) ?? null,
            mode: "ai",
          });
        }
      }

      throw new Error(data.error?.message || "Failed to call Gemini API");
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      answer: parsed.answer,
      basis: parsed.basis || "ADA/AHA CKM Protocols & Recent Telemetry",
      action: (parsed.action as ShifaAction) ?? null,
      mode: "ai",
    });
  } catch (error) {
    console.error("Shifa route failure:", error);
    return NextResponse.json(
      {
        answer:
          "দুঃখিত, সংযোগে সামান্য সমস্যা হয়েছে। তবে আপনার সাম্প্রতিক রক্তে শর্করা ৭.৭ mmol/L এবং রক্তচাপ ১৩৬/৮৬ mmHg রয়েছে, যা আপনার ১৪ দিনের বেসলাইনের তুলনায় সামান্য বেশি।",
        basis: "লাইফলুপ অফলাইন ফলব্যাক রুল",
        mode: "demo-fallback",
        action: "open_learning",
      },
      { status: 200 }
    );
  }
}