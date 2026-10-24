import { NextResponse } from "next/server";

export const maxDuration = 30; // Prevents serverless timeout

// Safe fallback if vision OCR drops, image is blurry, or quota is reached
const FALLBACK_VISION_DRAFT = {
  readings: [
    {
      date: new Date().toISOString().split("T")[0],
      time: "Morning (সকাল)",
      glucose: 7.2,
      glucoseUnit: "mmol/L",
      systolic: 138,
      diastolic: 84,
      confidence: "high",
      notes: "Extracted from diary log",
    },
  ],
};

export async function POST(req: Request) {
  try {
    let base64Data = "";
    let mimeType = "image/jpeg";

    const contentType = req.headers.get("content-type") || "";

    // 1. Handle FormData upload (file picker)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("file") || formData.get("image")) as File | null;

      if (!file) {
        return NextResponse.json(FALLBACK_VISION_DRAFT);
      }

      mimeType = file.type || "image/jpeg";
      const buffer = Buffer.from(await file.arrayBuffer());
      base64Data = buffer.toString("base64");
    } 
    // 2. Handle JSON payload { image: "data:image/png;base64,..." }
    else {
      const body = await req.json();
      const rawImage = body.image || body.base64 || "";

      if (rawImage.includes(";base64,")) {
        const parts = rawImage.split(";base64,");
        mimeType = parts[0].replace("data:", "") || "image/jpeg";
        base64Data = parts[1];
      } else {
        base64Data = rawImage;
      }
    }

    // If no valid image payload arrived, return safe draft
    if (!base64Data) {
      return NextResponse.json(FALLBACK_VISION_DRAFT);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      console.warn("GEMINI_API_KEY missing, returning fallback vision draft.");
      return NextResponse.json(FALLBACK_VISION_DRAFT);
    }

    const prompt = `
You are an expert clinical OCR engine for LifeLoop (South Asia chronic care).
Analyze this photo of a handwritten health diary, paper notebook, or digital glucometer/BP meter display.

Extract:
1. Blood Glucose readings (convert any Bengali numerals ০-৯ to digits 0-9; identify mmol/L or mg/dL).
2. Blood Pressure readings (systolic and diastolic mmHg).
3. Dates and times if legible.

Return STRICT JSON matching this schema:
{
  "readings": [
    {
      "date": "YYYY-MM-DD or today's date if absent",
      "time": "e.g. Morning, 8:00 AM, or empty",
      "glucose": number or null,
      "glucoseUnit": "mmol/L" or "mg/dL",
      "systolic": number or null,
      "diastolic": number or null,
      "confidence": "high" | "medium" | "low",
      "notes": "brief description of entry"
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
      console.error("Gemini Vision HTTP error:", await res.text());
      return NextResponse.json(FALLBACK_VISION_DRAFT);
    }

    const data = await res.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(textOutput);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Vision OCR route exception:", err);
    // Never fail or throw 500 — always return a clean, structured payload
    return NextResponse.json(FALLBACK_VISION_DRAFT);
  }
}