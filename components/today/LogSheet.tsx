"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Camera, Images, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ImagePickButton } from "@/components/today/ImagePickButton";
import { QtyEditRow } from "@/components/today/QtyEditRow";
import {
  macrosFromIngredients,
  parseFoodTextLocal,
  scaleDetected,
  scaleDetectedKcal,
  scaleDetectedQty,
  clampGrams,
} from "@/lib/food-log";
import { requestLogText } from "@/lib/gemini/client";
import { withGeminiWait } from "@/lib/gemini/wait";
import { mockBarcodeProduct } from "@/lib/mock-data";
import type { DetectedIngredient, DietType, Macros, MealType, ProfileId } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

export type FoodLogMode = "text" | "barcode" | "photo";

function scaleMacros(base: Macros, fromG: number, toG: number): Macros {
  const ratio = fromG > 0 ? toG / fromG : 1;
  return {
    calories: Math.round(base.calories * ratio),
    protein: Math.round(base.protein * ratio),
    carbs: Math.round(base.carbs * ratio),
    fat: Math.round(base.fat * ratio),
  };
}

export function LogSheet({
  mode,
  mealType,
  profileId,
  confirmLabel,
  textInput,
  setTextInput,
  ingredients,
  setIngredients,
  onClose,
  onAnalyzeText,
  onSaveText,
  onSaveBarcode,
  onSavePhoto,
}: {
  mode: FoodLogMode;
  mealType: MealType;
  profileId: ProfileId;
  confirmLabel?: string;
  textInput: string;
  setTextInput: (v: string) => void;
  ingredients: DetectedIngredient[];
  setIngredients: Dispatch<SetStateAction<DetectedIngredient[]>>;
  onClose: () => void;
  onAnalyzeText?: () => void | Promise<void>;
  onSaveText: () => void;
  onSaveBarcode: (grams: number) => void;
  onSavePhoto: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newGrams, setNewGrams] = useState("");
  const [textReview, setTextReview] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [barcodeGrams, setBarcodeGrams] = useState(mockBarcodeProduct.servingG);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setTextReview(false);
    setPhotoReady(false);
    setPhotoError(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBarcodeGrams(mockBarcodeProduct.servingG);
  }, [mode]);

  async function analyzePhoto(file: File) {
    setAnalyzing(true);
    setPhotoError(null);
    setPhotoReady(false);
    setIngredients([]);
    const url = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("diet", profileId === "elodie" ? "omnivore" : "vegan");
      const res = await withGeminiWait("Gemini lit la photo…", () =>
        fetch("/api/log-photo", { method: "POST", body: form }),
      );
      const data = (await res.json()) as { ingredients?: DetectedIngredient[]; error?: string };
      if (!res.ok || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
        setPhotoError(data.error ?? "Aucun aliment reconnu. Réessaie avec une autre photo.");
        return;
      }
      setIngredients(data.ingredients);
      setPhotoReady(true);
    } catch {
      setPhotoError("Analyse photo indisponible. Réessaie.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyzeText() {
    setAnalyzing(true);
    try {
      if (onAnalyzeText) {
        await onAnalyzeText();
      } else {
        const diet: DietType = profileId === "elodie" ? "omnivore" : "vegan";
        const parsed = await requestLogText(textInput, diet);
        setIngredients(parsed.length ? parsed : parseFoodTextLocal(textInput));
      }
      setTextReview(true);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30">
      <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">
            {mode === "text" && (textReview ? "Relecture texte / IA" : "Saisie texte / IA")}
            {mode === "barcode" && "Produit reconnu"}
            {mode === "photo" && (photoReady ? "Relecture photo" : "Photo du repas")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-health-muted">
          {profileId === "alexis" ? "Alexis" : "Élodie"} · {mealTypeLabel(mealType)}
        </p>

        {mode === "text" && !textReview && (
          <>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ex. pain bûcheron 40g avec margarine"
              className="h-24 w-full rounded-card bg-health-bg p-3 text-[14px] outline-none"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
              Chaque aliment est séparé (avec, et, virgule). Un poids écrit comme 20 g / 20 gr est repris tel quel.
            </p>
            <button
              type="button"
              disabled={analyzing || !textInput.trim()}
              onClick={() => void analyzeText()}
              className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {analyzing ? "Analyse…" : "Analyser"}
            </button>
          </>
        )}

        {mode === "text" && textReview && (
          <IngredientReview
            diet={profileId === "elodie" ? "omnivore" : "vegan"}
            ingredients={ingredients}
            setIngredients={setIngredients}
            newName={newName}
            setNewName={setNewName}
            newGrams={newGrams}
            setNewGrams={setNewGrams}
            confirmLabel={confirmLabel}
            onSave={onSaveText}
          />
        )}

        {mode === "barcode" && (
          <BarcodeQuantityEditor
            grams={barcodeGrams}
            onChange={setBarcodeGrams}
            mealType={mealType}
            confirmLabel={confirmLabel}
            onSave={() => onSaveBarcode(barcodeGrams)}
          />
        )}

        {mode === "photo" && !photoReady && (
          <>
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Aperçu du repas"
                className="mx-auto mb-3 h-28 w-28 rounded-2xl object-cover"
              />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <ImagePickButton
                icon={Camera}
                label={analyzing ? "Analyse…" : "Appareil photo"}
                capture
                disabled={analyzing}
                onPick={(file) => void analyzePhoto(file)}
              />
              <ImagePickButton
                icon={Images}
                label={analyzing ? "Analyse…" : "Photothèque"}
                disabled={analyzing}
                onPick={(file) => void analyzePhoto(file)}
              />
            </div>
            {photoError ? <p className="mt-2 text-[12px] text-coral">{photoError}</p> : null}
            <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
              L&apos;IA liste les aliments visibles. Tu corriges grammes, quantité ou kcal avant d&apos;enregistrer.
            </p>
          </>
        )}

        {mode === "photo" && photoReady && (
          <>
            <button
              type="button"
              onClick={() => {
                setPhotoReady(false);
                setPhotoError(null);
              }}
              className="mb-3 text-[12px] font-semibold text-health-muted"
            >
              Autre photo
            </button>
            <IngredientReview
              diet={profileId === "elodie" ? "omnivore" : "vegan"}
              ingredients={ingredients}
              setIngredients={setIngredients}
              newName={newName}
              setNewName={setNewName}
              newGrams={newGrams}
              setNewGrams={setNewGrams}
              confirmLabel={confirmLabel}
              onSave={onSavePhoto}
            />
          </>
        )}
      </div>
    </div>
  );
}

function BarcodeQuantityEditor({
  grams,
  onChange,
  mealType,
  confirmLabel,
  onSave,
}: {
  grams: number;
  onChange: (grams: number) => void;
  mealType: MealType;
  confirmLabel?: string;
  onSave: () => void;
}) {
  const product = mockBarcodeProduct;
  const macros = scaleMacros(product.macros, product.servingG, grams);
  const presets = [
    { label: "¼ portion", value: Math.max(1, Math.round(product.servingG / 4)) },
    { label: "½ portion", value: Math.max(1, Math.round(product.servingG / 2)) },
    { label: "1 portion", value: product.servingG },
    { label: "1 paquet", value: product.packG },
  ];

  function setGrams(next: number) {
    onChange(clampGrams(next));
  }

  function setKcal(kcal: number) {
    const density = product.servingG > 0 ? product.macros.calories / product.servingG : 0;
    if (density <= 0) return;
    setGrams(kcal / density);
  }

  return (
    <>
      <Card className="bg-health-bg shadow-none">
        <p className="text-[11px] text-health-muted">{product.barcode}</p>
        <p className="text-[16px] font-semibold">{product.name}</p>
        <p className="text-[13px] text-health-muted">
          {product.brand} · étiquette {product.servingG}g · paquet {product.packG}g
        </p>
      </Card>

      <p className="mb-2 mt-4 text-[13px] font-medium">Quantité consommée</p>
      <p className="mb-3 text-[12px] leading-relaxed text-health-muted">
        Grammes ou kcal : l&apos;un recalcule l&apos;autre depuis l&apos;étiquette.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setGrams(preset.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold",
              grams === preset.value ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 rounded-card bg-health-bg p-3">
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white text-xl leading-none"
          onClick={() => setGrams(grams - 5)}
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value) || 1)}
            className="w-16 rounded-md bg-white py-1 text-center text-[22px] font-semibold tabular-nums"
          />
          <span className="text-[13px] text-health-muted">g</span>
        </div>
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white text-xl leading-none"
          onClick={() => setGrams(grams + 5)}
        >
          +
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        <input
          inputMode="numeric"
          value={macros.calories}
          onChange={(e) => {
            const next = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(next) && next > 0) setKcal(next);
          }}
          className="w-16 rounded-md bg-health-bg py-1.5 text-center text-[15px] font-semibold tabular-nums"
        />
        <span className="text-[12px] font-semibold text-health-muted">kcal</span>
      </div>

      <Card className="mt-3 bg-health-bg shadow-none">
        <p className="text-[13px] font-semibold tabular-nums">
          {macros.calories} kcal · {macros.protein}g P · {macros.carbs}g G · {macros.fat}g L
        </p>
        <p className="mt-1 text-[11px] text-health-muted">
          Recalculé depuis {product.servingG}g ({product.macros.calories} kcal)
        </p>
      </Card>

      <button
        type="button"
        onClick={onSave}
        className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
      >
        {confirmLabel ?? `Ajouter ${grams}g au ${mealTypeLabel(mealType).toLowerCase()}`}
      </button>
    </>
  );
}

function IngredientReview({
  diet,
  ingredients,
  setIngredients,
  newName,
  setNewName,
  newGrams,
  setNewGrams,
  confirmLabel,
  onSave,
}: {
  diet: DietType;
  ingredients: DetectedIngredient[];
  setIngredients: Dispatch<SetStateAction<DetectedIngredient[]>>;
  newName: string;
  setNewName: (value: string) => void;
  newGrams: string;
  setNewGrams: (value: string) => void;
  confirmLabel?: string;
  onSave: () => void;
}) {
  const totals = macrosFromIngredients(ingredients);
  const [adding, setAdding] = useState(false);

  async function addManual() {
    if (!newName.trim() || adding) return;
    const raw = newGrams.trim() ? `${newName.trim()} ${newGrams}g` : newName.trim();
    setAdding(true);
    try {
      const parsed = await requestLogText(raw, diet);
      const extra = parsed.map((item, index) => ({ ...item, id: `n-${Date.now()}-${index}` }));
      if (!extra.length) return;
      setIngredients((list) => [...list, ...extra]);
      setNewName("");
      setNewGrams("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <p className="mb-2 text-[12px] leading-relaxed text-health-muted">
        Ajuste la quantité, les grammes ou les kcal. Rien n&apos;est enregistré tant que tu n&apos;as pas confirmé.
      </p>
      <div className="max-h-[38vh] space-y-1 overflow-y-auto">
        {ingredients.map((ing) => (
          <QtyEditRow
            key={ing.id}
            name={ing.name}
            qty={ing.qty ?? ing.grams}
            unit={ing.unit ?? "g"}
            grams={ing.grams}
            calories={ing.calories}
            detail={`${Math.round(ing.protein)}g P · ${ing.carbs ?? 0}g G · ${ing.fat ?? 0}g L`}
            onQty={(qty) =>
              setIngredients((list) =>
                list.map((item) => (item.id === ing.id ? scaleDetectedQty(item, qty) : item)),
              )
            }
            onGrams={(grams) =>
              setIngredients((list) =>
                list.map((item) => (item.id === ing.id ? scaleDetected(item, grams) : item)),
              )
            }
            onKcal={(kcal) =>
              setIngredients((list) =>
                list.map((item) => (item.id === ing.id ? scaleDetectedKcal(item, kcal) : item)),
              )
            }
            onRemove={() => setIngredients((list) => list.filter((item) => item.id !== ing.id))}
          />
        ))}
      </div>
      {ingredients.length > 0 && (
        <p className="mt-2 text-[12px] font-semibold tabular-nums text-health-muted">
          Total {totals.calories} kcal · {totals.protein}g P · {totals.carbs}g G · {totals.fat}g L
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addManual();
            }
          }}
          placeholder="Café au lait végétal d'avoine"
          className="flex-1 rounded-card bg-health-bg px-3 text-[13px]"
        />
        <input
          value={newGrams}
          onChange={(e) => setNewGrams(e.target.value)}
          placeholder="g"
          className="w-16 rounded-card bg-health-bg text-center text-[13px]"
        />
        <button
          type="button"
          disabled={adding || !newName.trim()}
          className="rounded-card bg-health-bg px-3 disabled:opacity-40"
          onClick={() => void addManual()}
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={onSave}
        className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
      >
        {confirmLabel ?? "Confirmer & enregistrer"}
      </button>
    </>
  );
}
