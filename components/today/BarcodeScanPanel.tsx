"use client";

import { useRef, useState } from "react";
import { Camera, Images, Keyboard } from "lucide-react";
import { ImagePickButton } from "@/components/today/ImagePickButton";
import { lookupBarcode, type BarcodeProduct } from "@/lib/barcode";
import { decodeBarcodeFromFile } from "@/lib/barcode-scan";

export function BarcodeScanPanel({ onProduct }: { onProduct: (product: BarcodeProduct) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const busyRef = useRef(false);

  async function lookup(code: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await lookupBarcode(code);
      if (result.product) {
        onProduct(result.product);
        return;
      }
      setError(result.error ?? "Produit introuvable.");
    } catch {
      setError("Open Food Facts indisponible.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function fromPhoto(file: File) {
    setBusy(true);
    setError(null);
    try {
      const code = await decodeBarcodeFromFile(file);
      if (!code) {
        setError("Aucun code-barres lu. Recadre le code, bien net, et réessaie.");
        return;
      }
      await lookup(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <ImagePickButton
          icon={Camera}
          label={busy ? "Lecture…" : "Appareil photo"}
          capture
          disabled={busy}
          onPick={(file) => void fromPhoto(file)}
        />
        <ImagePickButton
          icon={Images}
          label={busy ? "Lecture…" : "Photothèque"}
          disabled={busy}
          onPick={(file) => void fromPhoto(file)}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
        Photo du code-barres, puis Open Food Facts. Tu corriges les grammes avant d&apos;enregistrer.
      </p>

      {error ? <p className="mt-2 text-[12px] text-coral">{error}</p> : null}

      {showManual ? (
        <div className="mt-3 flex gap-2">
          <input
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 14))}
            placeholder="Ex. 3017620422003"
            className="min-w-0 flex-1 rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
          />
          <button
            type="button"
            disabled={busy || manual.length < 8}
            onClick={() => void lookup(manual)}
            className="rounded-card bg-health-ink px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            OK
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-health-muted"
          onClick={() => setShowManual(true)}
        >
          <Keyboard size={14} />
          Saisir le code
        </button>
      )}
    </div>
  );
}
