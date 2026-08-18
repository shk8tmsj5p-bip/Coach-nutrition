import { NextResponse } from "next/server";
import { callGeminiFlashVision, extractRenphoFromText } from "@/lib/gemini/renpho";
import { friendlyGeminiError } from "@/lib/gemini/models";

export const maxDuration = 60;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucune image" }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  try {
    const { text } = await callGeminiFlashVision(imageBase64, mimeType);
    const extracted = extractRenphoFromText(text);
    return NextResponse.json({ extracted, mock: false });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "OCR indisponible";
    console.error("[COACH GEN] OCR no mock —", raw);
    return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
  }
}
