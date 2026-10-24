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

    // আপনার যে মডেলটি লোকালে কাজ করছিল সেটিই প্রধান
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

    const requestPayload = {
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
    };

    // সরাসরি gemini-2.5-flash এবং ব্যাকআপ হিসেবে gemini-2.0-flash
    const candidateEndpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    ];

    let activeResponse: Response | null = null;
    let lastError = "";

    for (const endpoint of candidateEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        if (res.ok) {
          activeResponse = res;
          break;
        } else {
          lastError = await res.text();
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!activeResponse) {
      console.error("Gemini Vision failed:", lastError);
      return NextResponse.json({ ...FALLBACK_VISION_DRAFT, reason: lastError });
    }

    const data = await activeResponse.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(textOutput);

    return NextResponse.json({ ...parsed, isFallback: false });
  } catch (err: any) {
    console.error("Vision exception:", err);
    return NextResponse.json({ ...FALLBACK_VISION_DRAFT, reason: err.message });
  }
}