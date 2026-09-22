"use client";

import { useEffect, useState, type Ref } from "react";
import { Check, Copy } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { Card } from "@/components/ui/Card";
import { MealTemplatesEditor } from "@/components/parametres/MealTemplatesEditor";
import { SettingsHubBar, type SettingsHubId } from "@/components/parametres/SettingsHubBar";
import { StatusBadge, type ConnectionTone } from "@/components/parametres/StatusBadge";
import { TagInput } from "@/components/parametres/TagInput";
import { ToggleRow } from "@/components/parametres/ToggleRow";
import { HouseholdLockCard } from "@/components/parametres/HouseholdLockCard";
import { PlanActionSheet } from "@/components/repas/PlanActionSheet";
import {
  KITCHEN_APPLIANCES,
  loadKitchenPrefs,
  type KitchenApplianceId,
  type KitchenPrefs,
} from "@/lib/kitchen-prefs";
import { hydrateKitchenPrefsFromSupabase, persistKitchenPrefs } from "@/lib/supabase/parametres";
import { storage } from "@/lib/storage";
import { HEALTH_WEBHOOK_PATH } from "@/lib/health-webhook";
import type { SlotTemplate } from "@/lib/types";

const LEGACY_KEY_FIELDS = ["openai", "anthropic", "supabaseUrl", "supabaseAnon", "strava"] as const;

type StoredKeys = { gemini: string; webhook: string };

type ConnectionsStatus = {
  gemini: boolean;
  geminiPro: string;
  geminiFlash: string;
  healthWebhook: boolean;
  supabase: boolean;
  alerts: boolean;
};

function emptyKeys(): StoredKeys {
  return { gemini: "", webhook: "" };
}

function readStoredKeys(): StoredKeys {
  const stored = storage.getJSON<Record<string, string>>("api-keys", {});
  const cleaned = { ...stored };
  for (const field of LEGACY_KEY_FIELDS) delete cleaned[field];
  if (JSON.stringify(cleaned) !== JSON.stringify(stored)) {
    storage.setJSON("api-keys", cleaned);
  }
  return {
    gemini: cleaned.gemini ?? "",
    webhook: cleaned.webhook ?? "",
  };
}

function geminiTone(env: boolean, local: boolean): { tone: ConnectionTone; label: string } {
  if (env) return { tone: "ok", label: "Connecté" };
  if (local) return { tone: "warn", label: "Clé locale" };
  return { tone: "off", label: "À configurer" };
}

function webhookTone(
  secretEnv: boolean,
  secretLocal: boolean,
  supabase: boolean,
): { tone: ConnectionTone; label: string } {
  if (secretEnv) return { tone: "ok", label: "Actif" };
  if (secretLocal) return { tone: "warn", label: "Secret local" };
  if (supabase) return { tone: "warn", label: "Ouvert (dev)" };
  return { tone: "off", label: "À configurer" };
}

export default function ParametresScreen() {
  const { catalog, updateAversions, updateMealTemplates } = useProfile();
  const [sheet, setSheet] = useState<SettingsHubId | null>(null);
  const [prefs, setPrefs] = useState<KitchenPrefs>(() => loadKitchenPrefs());
  const [alexisAversions, setAlexisAversions] = useState(catalog.alexis.aversions);
  const [elodieAversions, setElodieAversions] = useState(catalog.elodie.aversions);
  const [alexisTemplates, setAlexisTemplates] = useState<SlotTemplate[]>(
    () => catalog.alexis.mealTemplates,
  );
  const [elodieTemplates, setElodieTemplates] = useState<SlotTemplate[]>(
    () => catalog.elodie.mealTemplates,
  );
  const [draftKeys, setDraftKeys] = useState<StoredKeys>(emptyKeys);
  const [savedKeys, setSavedKeys] = useState<StoredKeys>(emptyKeys);
  const [connections, setConnections] = useState<ConnectionsStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const webhookUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}${HEALTH_WEBHOOK_PATH}`;

  useEffect(() => {
    const stored = readStoredKeys();
    setSavedKeys(stored);
    void hydrateKitchenPrefsFromSupabase().then(setPrefs);
    void fetch("/api/connections")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConnectionsStatus | null) => {
        if (data) setConnections(data);
      })
      .catch(() => undefined);
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  function persistPrefs(next: KitchenPrefs) {
    void persistKitchenPrefs({ ...next, extraTastes: next.extraRules }).then((error) => {
      if (error) showToast("Préférences en local (Supabase incomplet)");
    });
  }

  function patchPrefs(patch: Partial<KitchenPrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      persistPrefs(next);
      return next;
    });
  }

  function patchAversions(profileId: "alexis" | "elodie", next: string[]) {
    if (profileId === "alexis") setAlexisAversions(next);
    else setElodieAversions(next);
    void updateAversions(profileId, next).then((error) => {
      if (error) showToast("Aversions en local (Supabase incomplet)");
    });
  }

  function commitKey(field: keyof StoredKeys, raw: string) {
    setDraftKeys((current) => ({ ...current, [field]: raw }));
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSavedKeys((current) => {
      const next = { ...current, [field]: trimmed };
      storage.setJSON("api-keys", next);
      return next;
    });
  }

  async function copyWebhook(url = webhookUrl, key = "main") {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      showToast("URL webhook copiée");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      showToast("Impossible de copier l’URL");
    }
  }

  const gemini = geminiTone(Boolean(connections?.gemini), Boolean(savedKeys.gemini));
  const health = webhookTone(
    Boolean(connections?.healthWebhook),
    Boolean(savedKeys.webhook),
    Boolean(connections?.supabase),
  );

  return (
    <div>
      <h1 className="text-[22px] font-bold tracking-tight">Paramètres</h1>
      <p className="mt-0.5 text-[12px] text-health-muted">
        Accès, cuisine, habitudes, connexions
      </p>

      <SettingsHubBar onOpen={setSheet} />

      {sheet === "acces" ? (
        <PlanActionSheet title="Accès" onClose={() => setSheet(null)}>
          <HouseholdLockCard hideTitle alertsOn={Boolean(connections?.alerts)} />
        </PlanActionSheet>
      ) : null}

      {sheet === "regles" ? (
        <PlanActionSheet title="Règles" onClose={() => setSheet(null)}>
          <Card compact>
        <p className="text-[13px] font-semibold">Lois du foyer</p>
        <div className="mt-0.5">
          <ToggleRow
            label="Recettes express"
            hint="Préparation très rapide. Sinon le classique : recettes détaillées, matériel du foyer."
            checked={prefs.recipePace === "express"}
            onChange={(on) => patchPrefs({ recipePace: on ? "express" : "equilibre" })}
          />
          <ToggleRow
            label="Épices complexes"
            hint="Choisir des recettes qui jouent vraiment des épices. Pas en coller si le plat n’en a pas."
            checked={prefs.heatStyle === "complexe"}
            onChange={(on) => patchPrefs({ heatStyle: on ? "complexe" : "neutre" })}
          />
          <ToggleRow
            label="Pas de simili-carné en semaine"
            hint="Steaks / saucisses végétales : week-end uniquement."
            checked={prefs.mockMeatsWeekendOnly}
            onChange={(mockMeatsWeekendOnly) => patchPrefs({ mockMeatsWeekendOnly })}
          />
          <ToggleRow
            label="Dîners Low Calorie"
            hint="Tous les soirs : low cal. Gem dose comme il veut."
            checked={prefs.dinnersLowCal}
            onChange={(dinnersLowCal) => patchPrefs({ dinnersLowCal })}
          />
          <ToggleRow
            label="Adapter à la météo"
            hint="Éclairage chaud / froid selon le jour à Eschentzwiller. Pas un menu imposé."
            checked={prefs.weatherAdaptive}
            onChange={(weatherAdaptive) => patchPrefs({ weatherAdaptive })}
          />
          <ToggleRow
            label="Légumes de saison"
            hint="Privilégier les légumes du moment (Alsace). Pas une liste fermée."
            checked={prefs.seasonalProduce}
            onChange={(seasonalProduce) => patchPrefs({ seasonalProduce })}
          />
          <ToggleRow
            label="Sauces 100% maison"
            hint="Si le plat a une sauce : chaque composant dosé, jamais un pot du commerce. Pas d’obligation d’en inventer une."
            checked={prefs.homemadeSauces}
            onChange={(homemadeSauces) => patchPrefs({ homemadeSauces })}
          />
        </div>

        <p className="mt-3 text-[13px] font-semibold">+ Critère libre</p>
        <p className="mt-0.5 text-[11px] text-health-muted">
          Optionnel. Gem les lit si tu en ajoutes. Ne force pas un ingrédient sur toutes les recettes.
        </p>
        <div className="mt-1.5">
          <TagInput
            tags={prefs.extraRules}
            onChange={(extraRules) => patchPrefs({ extraRules, extraTastes: extraRules })}
            placeholder="Ajouter un critère"
            accent="ink"
            addLabel="+"
          />
        </div>
      </Card>
        </PlanActionSheet>
      ) : null}

      {sheet === "aversions" ? (
        <PlanActionSheet title="Aversions" onClose={() => setSheet(null)}>
      <Card compact>
        <p className="text-[13px] font-semibold">Gérer les aversions</p>
        <p className="mt-0.5 text-[11px] text-health-muted">
          Ingrédients bannis par profil — omis à la génération.
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-coral-dark">
          Alexis
        </p>
        <div className="mt-1">
          <TagInput
            tags={alexisAversions}
            onChange={(next) => patchAversions("alexis", next)}
            placeholder="Ajouter (ex. coriandre)"
            accent="coral"
          />
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-violet-dark">
          Élodie
        </p>
        <div className="mt-1">
          <TagInput
            tags={elodieAversions}
            onChange={(next) => patchAversions("elodie", next)}
            placeholder="Ajouter (ex. beurre de cacahuète)"
            accent="violet"
          />
        </div>
      </Card>
        </PlanActionSheet>
      ) : null}

      {sheet === "materiel" ? (
        <PlanActionSheet title="Matériel" onClose={() => setSheet(null)}>
      <Card compact>
        <p className="text-[13px] font-semibold">Matériel à disposition</p>
        <div className="mt-0.5">
          {KITCHEN_APPLIANCES.map((item) => (
            <ToggleRow
              key={item.id}
              label={item.label}
              checked={prefs.appliances[item.id]}
            onChange={(on) =>
              setPrefs((current) => {
                const next = {
                  ...current,
                  appliances: { ...current.appliances, [item.id]: on } as Record<
                    KitchenApplianceId,
                    boolean
                  >,
                };
                persistPrefs(next);
                return next;
              })
            }
            />
          ))}
        </div>
      </Card>
        </PlanActionSheet>
      ) : null}

      {sheet === "habitudes" ? (
        <PlanActionSheet title="Habitudes" onClose={() => setSheet(null)}>
      <p className="mb-1.5 px-0.5 text-[11px] leading-snug text-health-muted">
        Petit-déj, collations et desserts — modèles stables par jour. À l’ajout d’un ingrédient, Gemini
        estime les kcal d’après ta phrase (lait d’avoine ≠ flocons). Les desserts s’ajoutent au déjeuner
        / dîner. Le plat vient de Repas. Un changement s’applique tout de suite à Aujourd’hui.
      </p>
      <MealTemplatesEditor
        profileId="alexis"
        name="Alexis"
        accent="coral"
        templates={alexisTemplates}
        onChange={(next) => {
          setAlexisTemplates(next);
          void updateMealTemplates({ alexis: next });
        }}
      />
      <MealTemplatesEditor
        profileId="elodie"
        name="Élodie"
        accent="violet"
        templates={elodieTemplates}
        onChange={(next) => {
          setElodieTemplates(next);
          void updateMealTemplates({ elodie: next });
        }}
      />
        </PlanActionSheet>
      ) : null}

      {sheet === "cles" ? (
        <PlanActionSheet title="Clés API" onClose={() => setSheet(null)}>
      <Card compact>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Google Gemini API</p>
            <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
              Pro · Gem Chef
              {connections?.geminiPro ? ` (${connections.geminiPro})` : ""}
              {" · "}
              Flash · Coach / vision
              {connections?.geminiFlash ? ` (${connections.geminiFlash})` : ""}
            </p>
          </div>
          <StatusBadge tone={gemini.tone} label={gemini.label} />
        </div>
        <MaskedKeyField
          label="Clé Gemini"
          value={draftKeys.gemini}
          hasSaved={Boolean(savedKeys.gemini) || Boolean(connections?.gemini)}
          onChange={(geminiKey) => commitKey("gemini", geminiKey)}
        />
      </Card>

      <Card compact className="mt-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Apple Santé & Webhook</p>
            <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
              Colle cette URL dans le Raccourci iOS. Pas, énergie, et séances de l’Apple Watch.
            </p>
          </div>
          <StatusBadge tone={health.tone} label={health.label} />
        </div>
        <div className="mt-2 rounded-lg bg-health-bg px-2.5 py-2">
          <p className="break-all font-mono text-[10px] leading-snug text-health-muted">
            {webhookUrl || HEALTH_WEBHOOK_PATH}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyWebhook()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-health-ink py-2.5 text-[12px] font-semibold text-health-on-fill"
        >
          {copied === "main" ? <Check size={13} /> : <Copy size={13} />}
          {copied === "main" ? "URL copiée" : "Copier l'URL du Webhook"}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-health-muted">
          Deux raccourcis : un par iPhone. Ajoute <span className="font-mono">?profile_id=</span>
          alexis ou elodie. Sur iPhone, l&apos;URL doit être publique (pas localhost).
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <ProfileWebhookCopy
            label="Alexis"
            copied={copied === "alexis"}
            onCopy={() => void copyWebhook(`${webhookUrl}?profile_id=alexis`, "alexis")}
          />
          <ProfileWebhookCopy
            label="Élodie"
            copied={copied === "elodie"}
            onCopy={() => void copyWebhook(`${webhookUrl}?profile_id=elodie`, "elodie")}
          />
        </div>
        <MaskedKeyField
          label="Secret webhook"
          value={draftKeys.webhook}
          hasSaved={Boolean(savedKeys.webhook) || Boolean(connections?.healthWebhook)}
          onChange={(webhook) => commitKey("webhook", webhook)}
        />
      </Card>
        </PlanActionSheet>
      ) : null}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-health-ink px-4 py-2 text-[13px] font-medium text-health-on-fill shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}

function MaskedKeyField({
  label,
  value,
  hasSaved,
  onChange,
  inputRef,
}: {
  label: string;
  value: string;
  hasSaved: boolean;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-[11px] font-medium text-health-muted">{label}</span>
      <input
        ref={inputRef}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hasSaved ? "••••••••" : "Coller une clé (optionnel)"}
        className="mt-0.5 w-full rounded-lg bg-health-bg px-2.5 py-1.5 text-[13px] outline-none"
      />
    </label>
  );
}

function ProfileWebhookCopy({
  label,
  copied,
  onCopy,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="flex items-center justify-center gap-1 rounded-xl bg-health-bg py-2 text-[11px] font-semibold"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copié" : label}
    </button>
  );
}

