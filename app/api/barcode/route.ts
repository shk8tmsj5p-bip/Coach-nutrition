import { NextResponse } from "next/server";
import { isPlausibleBarcode, normalizeBarcode, parseOffProduct } from "@/lib/barcode";

export const maxDuration = 20;

export async function GET(request: Request) {
  const code = normalizeBarcode(new URL(request.url).searchParams.get("code") ?? "");
  if (!isPlausibleBarcode(code)) {
    return NextResponse.json({ error: "Code-barres invalide." }, { status: 400 });
  }
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: {
        "User-Agent": "CoachNutrition/1.0 (https://github.com/shk8tmsj5p-bip/Coach-nutrition)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Open Food Facts indisponible." }, { status: 502 });
    }
    const parsed = parseOffProduct(await res.json(), code);
    if (!parsed) {
      return NextResponse.json({ error: "Produit introuvable dans Open Food Facts." }, { status: 404 });
    }
    return NextResponse.json({ product: parsed });
  } catch {
    return NextResponse.json({ error: "Open Food Facts indisponible." }, { status: 502 });
  }
}
