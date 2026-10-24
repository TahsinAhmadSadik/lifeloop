import { NextResponse } from "next/server";

export const maxDuration = 25;

const FALLBACK_VISION_DRAFT = {
  isFallback: true,
  readings: [
    {
      date: new Date().toISOString().split("T")[0],
      time: "সকাল (Morning)",
      glucose: 7.2,
      glucoseUnit: "mmol/L",
      systolic: 138,
      diastolic: 84,
      confidence: "high",
      notes: "ডেমো ফলব্যাক: নেটওয়ার্ক বা এপিআই সীমাবদ্ধতার কারণে নমুনা প্রদর্শিত",
    },
  ],
};

export async function POST(req: Request) {
  try {
    let base64Data = "";
    let mimeType = "image/jpeg";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("file") || formData.get("image")) as File | null;
      if (!file) return NextResponse.json(FALLBACK_VISION_DRAFT);
      mimeType = file.type || "image/jpeg";
      const buffer = Buffer.from(await file.arrayBuffer());
      base64Data = buffer.toString("base64");
    } else {
      const body = await req.json();
      const raw = body.image || body.base64 || "";
      if (raw.includes(";base64,")) {
        const parts = raw.split(";base64,");
        mimeType = parts[0].replace("data:", "") || "image/jpeg";
        base64Data = parts[1];
      } else {
        base64Data = raw;
      }
    }

    if (!base64Data) {
      return NextResponse.json(FALLBACK_VISION_DRAFT);
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY missing in environment");
      return NextResponse.json({ ...FALLBACK_VISION_DRAFT, reason: "API Key Not Found" });
    }

    // Use gemini-3.8-flash as advised by the Google API
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const prompt = `
You are a medical OCR engine for LifeLoop.
Analyze this photo of a handwritten health diary or glucometer/BP monitor display.
Extract:
1. Blood Glucose (convert Bengali digits ০-৯ to 0-9; identify mmol/L or mg/dL).
2. Blood Pressure (systolic / diastolic mmHg).
3. Date and time if visible.

Output strictly in JSON:
{
  "readings": [
    {
      "date": "YYYY-MM-DD",
      "time": "Morning / Evening or string",
      "glucose": number or null,
      "glucoseUnit": "mmol/L" or "mg/dL",
      "systolic": number or null,
      "diastolic": number or null,
      "confidence": "high" | "medium" | "low",
      "notes": "Extracted via Gemini Vision"
    }
  ]
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini Vision API error:", errText);
      return NextResponse.json({ ...FALLBACK_VISION_DRAFT, reason: errText });
    }

    const data = await res.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(textOutput);

    return NextResponse.json({ ...parsed, isFallback: false });
  } catch (err: any) {
    console.error("Vision exception:", err);
    return NextResponse.json({ ...FALLBACK_VISION_DRAFT, reason: err.message });
  }
}