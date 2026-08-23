"use client";

import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { BrowserMultiFormatOneDReader } from "@zxing/browser";

const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

function reader() {
  return new BrowserMultiFormatOneDReader(HINTS as Map<DecodeHintType, unknown>);
}

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<DetectedBarcode[]>;
};

function nativeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  } catch {
    return null;
  }
}

export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  const detector = nativeDetector();
  if (detector) {
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const value = codes[0]?.rawValue?.replace(/\D/g, "");
      if (value) return value;
    } catch {
      /* zxing fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const result = await reader().decodeFromImageUrl(url);
    return result.getText().replace(/\D/g, "") || null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
