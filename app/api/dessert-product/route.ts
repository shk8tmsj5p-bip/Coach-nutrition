import { NextResponse } from "next/server";
import { analyzeDessertProductPhoto } from "@/lib/dessert-product";
import { friendlyGeminiError } from "@/lib/gemini/models";

export const maxDuration = 90;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Photo manquante" }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucune photo" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo trop lourde (max 8 Mo)." }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  try {
    const product = await analyzeDessertProductPhoto(imageBase64, mimeType);
    return NextResponse.json({ product });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Analyse photo indisponible";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 502 });
  }
}
