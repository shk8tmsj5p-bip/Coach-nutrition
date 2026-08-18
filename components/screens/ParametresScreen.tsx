"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Check, Copy, Moon, RefreshCw, Sun } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ChipSelector } from "@/components/parametres/ChipSelector";
import { StatusBadge, type ConnectionTone } from "@/components/parametres/StatusBadge";
import { TagInput } from "@/components/parametres/TagInput";
import { ToggleRow } from "@/components/parametres/ToggleRow";
import {
  HEAT_STYLE_LABEL,
  KITCHEN_APPLIANCES,
  loadKitchenPrefs,
  RECIPE_PACE_LABEL,
  type HeatStyle,
  type KitchenApplianceId,
  type KitchenPrefs,
  type RecipePace,
} from "@/lib/kitchen-prefs";
import { hydrateKitchenPrefsFromSupabase, persistKitchenPrefs } from "@/lib/supabase/parametres";
import { storage } from "@/lib/storage";
import { HEALTH_WEBHOOK_PATH } from "@/lib/health-webhook";
import { cn } from "@/lib/utils";

const PACE_OPTIONS: { id: RecipePace; label: string }[] = [
  { id: "express", label: RECIPE_PACE_LABEL.express },
  { id: "equilibre", label: RECIPE_PACE_LABEL.equilibre },
  { id: "gastro", label: RECIPE_PACE_LABEL.gastro },
];

const HEAT_OPTIONS: { id: HeatStyle; label: string }[] = [
  { id: "complexe", label: HEAT_STYLE_LABEL.complexe },
  { id: "doux", label: HEAT_STYLE_LABEL.doux },
  { id: "neutre", label: HEAT_STYLE_LABEL.neutre },
];

const LEGACY_KEY_FIELDS = ["openai", "anthropic", "supabaseUrl", "supabaseAnon"] as const;

type StoredKeys = { gemini: string; strava: string; webhook: string };

type ConnectionsStatus = {
  gemini: boolean;
  geminiPro: string;
  geminiFlash: string;
  strava: boolean;
  stravaToken: boolean;
  healthWebhook: boolean;
  supabase: boolean;
};

function emptyKeys(): StoredKeys {
  return { gemini: "", strava: "", webhook: "" };
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
    strava: cleaned.strava ?? "",
    webhook: cleaned.webhook ?? "",
  };
}

function geminiTone(env: boolean, local: boolean): { tone: ConnectionTone; label: string } {
  if (env) return { tone: "ok", label: "Connecté" };
  if (local) return { tone: "warn", label: "Clé locale" };
  return { tone: "off", label: "À configurer" };
}

function stravaTone(
  clientOk: boolean,
  tokenEnv: boolean,
  tokenLocal: boolean,
): { tone: ConnectionTone; label: string } {
  if (clientOk && (tokenEnv || tokenLocal)) return { tone: "ok", label: "Connecté" };
  if (clientOk) return { tone: "warn", label: "À reconnecter" };
  if (tokenLocal) return { tone: "warn", label: "Clé locale" };
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
  const { catalog, updateAversions } = useProfile();
  const { scheme, setScheme } = useTheme();
  const [prefs, setPrefs] = useState<KitchenPrefs>(() => loadKitchenPrefs());
  const [alexisAversions, setAlexisAversions] = useState(catalog.alexis.aversions);
  const [elodieAversions, setElodieAversions] = useState(catalog.elodie.aversions);
  const [draftKeys, setDraftKeys] = useState<StoredKeys>(emptyKeys);
  const [savedKeys, setSavedKeys] = useState<StoredKeys>(emptyKeys);
  const [connections, setConnections] = useState<ConnectionsStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const stravaInputRef = useRef<HTMLInputElement>(null);
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

  function patchPrefs(patch: Partial<KitchenPrefs>) {
    setPrefs((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setSaving(true);
    try {
      const nextKeys: StoredKeys = {
        gemini: draftKeys.gemini.trim() || savedKeys.gemini,
        strava: draftKeys.strava.trim() || savedKeys.strava,
        webhook: draftKeys.webhook.trim() || savedKeys.webhook,
      };
      storage.setJSON("api-keys", nextKeys);
      setSavedKeys(nextKeys);
      setDraftKeys(emptyKeys);

      const prefError = await persistKitchenPrefs(prefs);
      const alexisError = await updateAversions("alexis", alexisAversions);
      const elodieError = await updateAversions("elodie", elodieAversions);
      const remote = [prefError, alexisError, elodieError].filter(Boolean);
      showToast(
        remote.length
          ? "Préférences enregistrées en local (Supabase incomplet)"
          : "Préférences enregistrées",
      );
    } finally {
      setSaving(false);
    }
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
  const strava = stravaTone(
    Boolean(connections?.strava),
    Boolean(connections?.stravaToken),
    Boolean(savedKeys.strava),
  );
  const health = webhookTone(
    Boolean(connections?.healthWebhook),
    Boolean(savedKeys.webhook),
    Boolean(connections?.supabase),
  );

  return (
    <div>
      <h1 className="text-[22px] font-bold tracking-tight">Paramètres</h1>
      <p className="mt-0.5 text-[12px] text-health-muted">
        Cuisine foyer, connexions API, apparence
      </p>

      <SectionTitle className="mb-1.5 mt-3">Préférences cuisine & foyer</SectionTitle>
      <Card compact>
        <p className="text-[13px] font-semibold">Type de recettes</p>
        <div className="mt-1.5">
          <ChipSelector value={prefs.recipePace} options={PACE_OPTIONS} onChange={(recipePace) => patchPrefs({ recipePace })} />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-health-muted">
          Express = recettes ultra-détaillées, assemblage et préparation ultra-rapides
        </p>

        <p className="mt-3 text-[13px] font-semibold">Niveau d&apos;épices & saveurs</p>
        <div className="mt-1.5">
          <ChipSelector
            stacked
            value={prefs.heatStyle}
            options={HEAT_OPTIONS}
            onChange={(heatStyle) => patchPrefs({ heatStyle })}
          />
        </div>
      </Card>

      <Card compact className="mt-1.5">
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
            onChange={setAlexisAversions}
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
            onChange={setElodieAversions}
            placeholder="Ajouter (ex. beurre de cacahuète)"
            accent="violet"
          />
        </div>
      </Card>

      <Card compact className="mt-1.5">
        <p className="text-[13px] font-semibold">Matériel à disposition</p>
        <div className="mt-0.5">
          {KITCHEN_APPLIANCES.map((item) => (
            <ToggleRow
              key={item.id}
              label={item.label}
              checked={prefs.appliances[item.id]}
              onChange={(on) =>
                patchPrefs({
                  appliances: { ...prefs.appliances, [item.id]: on } as Record<
                    KitchenApplianceId,
                    boolean
                  >,
                })
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] font-semibold">Règles tofu & simili-carnés</p>
        <div className="mt-0.5">
          <ToggleRow
            label="Tofu cru uniquement en semaine"
            hint="Lun–Ven : pressé, mariné, servi frais. Cuit OK desserts et week-end."
            checked={prefs.tofuWeekdayFresh}
            onChange={(tofuWeekdayFresh) => patchPrefs({ tofuWeekdayFresh })}
          />
          <ToggleRow
            label="Pas de simili-carné en semaine"
            hint="Steaks / saucisses végétales : week-end uniquement."
            checked={prefs.mockMeatsWeekendOnly}
            onChange={(mockMeatsWeekendOnly) => patchPrefs({ mockMeatsWeekendOnly })}
          />
        </div>
        <p className="mt-2 text-[13px] font-semibold">Préférences dîner</p>
        <div className="mt-0.5">
          <ToggleRow
            label="Dîners Low Calorie systématiques"
            hint="Tous les soirs : variante allégée."
            checked={prefs.dinnersLowCal}
            onChange={(dinnersLowCal) => patchPrefs({ dinnersLowCal })}
          />
        </div>
      </Card>

      <SectionTitle className="mb-1.5 mt-3">Connexions & clés API</SectionTitle>
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
          onChange={(geminiKey) => setDraftKeys((current) => ({ ...current, gemini: geminiKey }))}
        />
      </Card>

      <Card compact className="mt-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Strava API</p>
            <p className="mt-0.5 text-[11px] text-health-muted">
              Séances sport uniquement — pas les pas du jour.
            </p>
          </div>
          <StatusBadge tone={strava.tone} label={strava.label} />
        </div>
        <MaskedKeyField
          inputRef={stravaInputRef}
          label="Refresh token Strava"
          value={draftKeys.strava}
          hasSaved={Boolean(savedKeys.strava) || Boolean(connections?.stravaToken)}
          onChange={(stravaKey) => setDraftKeys((current) => ({ ...current, strava: stravaKey }))}
        />
        <button
          type="button"
          onClick={() => {
            stravaInputRef.current?.focus();
            showToast("Colle un nouveau refresh token, puis enregistre");
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-health-bg py-2 text-[12px] font-semibold"
        >
          <RefreshCw size={13} />
          Reconnecter Strava
        </button>
      </Card>

      <Card compact className="mt-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Apple Santé & Webhook</p>
            <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
              Collez cette URL dans votre Raccourci iOS pour envoyer automatiquement vos pas et
              séances d&apos;entraînement.
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
          onChange={(webhook) => setDraftKeys((current) => ({ ...current, webhook }))}
        />
      </Card>

      <SectionTitle className="mb-1.5 mt-3">Thème & apparence</SectionTitle>
      <Card compact>
        <p className="text-[13px] font-semibold">Mode d&apos;affichage</p>
        <p className="mt-0.5 text-[11px] text-health-muted">
          Même réglage que le bouton Lune / Soleil en haut de l&apos;écran.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <ThemeChoice
            active={scheme === "light"}
            icon={<Sun size={16} />}
            label="Clair"
            onClick={() => setScheme("light")}
          />
          <ThemeChoice
            active={scheme === "dark"}
            icon={<Moon size={16} />}
            label="Sombre"
            onClick={() => setScheme("dark")}
          />
        </div>
      </Card>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-3 w-full rounded-card bg-health-ink py-3 text-[14px] font-semibold text-health-on-fill disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer les préférences"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-health-ink px-4 py-2 text-[13px] font-medium text-health-on-fill shadow-card">
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

function ThemeChoice({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold",
        active ? "bg-health-ink text-health-on-fill" : "bg-health-bg text-health-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
