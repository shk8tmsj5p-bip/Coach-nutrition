function unique(models: Array<string | undefined | null>) {
  return [...new Set(models.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

export type GeminiTier = "pro" | "flash";

export type GeminiCallResult = {
  text: string;
  model: string;
  tier: GeminiTier;
  warning?: string;
};

export type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

const LIST_TTL_MS = 45 * 60 * 1000;
const MAX_PER_TIER = 4;
const SKIP =
  /embed|imagen|veo|tts|aqa|gemma|computer|audio|robotics|deep-research|customtools|native-audio|live|image/i;

function isStandardTextModel(id: string) {
  const n = id.toLowerCase();
  if (SKIP.test(n)) return false;
  if (n === "gemini-pro-latest" || n === "gemini-flash-latest") return true;
  return /^gemini-\d+(\.\d+)?-(pro|flash)(-lite)?(-preview)?$/i.test(n);
}

type ListedModel = { id: string; methods: string[] };

let listedCache: { at: number; models: ListedModel[] } | null = null;

function stripPrefix(name: string) {
  return name.replace(/^models\//, "").trim();
}

function classify(id: string): GeminiTier | null {
  if (!isStandardTextModel(id)) return null;
  if (/flash/i.test(id)) return "flash";
  if (/pro/i.test(id)) return "pro";
  return null;
}

function versionScore(id: string) {
  const match = id.match(/(\d+)\.(\d+)/);
  const major = match ? Number(match[1]) : 0;
  const minor = match ? Number(match[2]) : 0;
  let score = major * 1000 + minor * 10;
  if (/lite/i.test(id)) score -= 4;
  if (/preview|exp/i.test(id)) score -= 1;
  return score;
}

function sortNewest(ids: string[]) {
  return [...ids].sort((a, b) => versionScore(b) - versionScore(a) || a.localeCompare(b));
}

function retryable(status: number) {
  return status === 404 || status === 429 || status === 503 || status === 500;
}

function isQuota(status: number, detail: string) {
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota|rate-limits/i.test(detail);
}

export function friendlyGeminiError(raw?: string | null) {
  if (!raw?.trim()) return "Gemini n'a pas pu répondre. Réessaie.";
  if (/timeout|aborted|AbortError|DEADLINE|timed out|504|UND_ERR|ECONNRESET|socket/i.test(raw)) {
    return "Gemini a mis trop longtemps. Réessaie — Lun–Ven peut prendre 1 à 2 min.";
  }
  if (/JSON|sans recette|Unexpected token|incomplète/i.test(raw)) {
    return "Réponse Gemini incomplète. Réessaie, le modèle a parfois besoin d'un second essai.";
  }
  if (/no longer available|NOT_FOUND|404/i.test(raw)) {
    return "Aucun modèle Gemini disponible pour cette clé. Réessaie dans un instant.";
  }
  if (/API_KEY|manquante|401|403|API key/i.test(raw)) {
    return "Clé Gemini refusée. Vérifie GEMINI_API_KEY dans .env.local.";
  }
  if (/quota|429|RESOURCE_EXHAUSTED|rate-limits/i.test(raw)) {
    return "Limite Gemini (Pro et Flash) atteinte. Réessaie dans quelques minutes.";
  }
  if (/503|overloaded|UNAVAILABLE/i.test(raw)) {
    return "Gemini est saturé pour le moment. Réessaie dans une minute.";
  }
  return "Gemini n'a pas pu répondre. Réessaie.";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchListedModels(): Promise<ListedModel[]> {
  if (listedCache && Date.now() - listedCache.at < LIST_TTL_MS) return listedCache.models;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const models: ListedModel[] = [];
  let pageToken = "";
  try {
    for (let page = 0; page < 6; page += 1) {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "x-goog-api-key": apiKey },
      });
      if (!response.ok) {
        console.warn("[GEMINI] list models", response.status);
        break;
      }
      const payload = (await response.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        nextPageToken?: string;
      };
      for (const item of payload.models ?? []) {
        const id = stripPrefix(item.name ?? "");
        if (!id) continue;
        models.push({ id, methods: item.supportedGenerationMethods ?? [] });
      }
      pageToken = payload.nextPageToken ?? "";
      if (!pageToken) break;
    }
  } catch (error) {
    console.warn("[GEMINI] list models failed", error instanceof Error ? error.message : error);
  }

  listedCache = { at: Date.now(), models };
  return models;
}

function invalidateListedModels() {
  listedCache = null;
}

async function modelsFor(tier: GeminiTier): Promise<string[]> {
  const listed = await fetchListedModels();
  const live = sortNewest(
    listed
      .filter((item) => item.methods.includes("generateContent") || item.methods.length === 0)
      .map((item) => item.id)
      .filter((id) => classify(id) === tier),
  );
  const envPref = (tier === "pro" ? process.env.GEMINI_MODEL_PRO : process.env.GEMINI_MODEL_FLASH)?.trim();
  const seeds =
    tier === "pro"
      ? ["gemini-pro-latest", "gemini-3.1-pro-preview"]
      : ["gemini-flash-latest", "gemini-3.5-flash", "gemini-3-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
  const ordered = unique([
    envPref && classify(envPref) === tier ? envPref : undefined,
    ...live,
    ...seeds,
  ]).filter((id) => classify(id) === tier);
  return ordered.slice(0, MAX_PER_TIER);
}

export async function resolvedGeminiLabels() {
  const [pro, flash] = await Promise.all([modelsFor("pro"), modelsFor("flash")]);
  return {
    geminiPro: pro[0] ?? "auto",
    geminiFlash: flash[0] ?? "auto",
  };
}

/** @deprecated kept for older imports — live list is the source of truth. */
export async function geminiProModels() {
  return modelsFor("pro");
}

export async function geminiFlashModels() {
  return modelsFor("flash");
}

function looksLikeJson(raw: string) {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```[\s\n]*$/, "").trim();
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        JSON.parse(trimmed.slice(start, end + 1));
        return true;
      } catch {
        return false;
      }
    }
    const a = trimmed.indexOf("[");
    const b = trimmed.lastIndexOf("]");
    if (a >= 0 && b > a) {
      try {
        JSON.parse(trimmed.slice(a, b + 1));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function generateGeminiJson(opts: {
  preferredTier: GeminiTier;
  fallbackTier?: GeminiTier;
  parts: GeminiPart[];
  temperature: number;
  logLabel: string;
  maxOutputTokens?: number;
  maxModelsPerTier?: number;
}): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`[${opts.logLabel}] FAIL: GEMINI_API_KEY manquante dans .env.local`);
    throw new Error("GEMINI_API_KEY manquante dans .env.local");
  }
  const key = apiKey;
  const cap = Math.max(1, opts.maxModelsPerTier ?? MAX_PER_TIER);

  const primary = (await modelsFor(opts.preferredTier)).slice(0, cap);
  const fallback =
    opts.fallbackTier && opts.fallbackTier !== opts.preferredTier
      ? (await modelsFor(opts.fallbackTier)).slice(0, cap)
      : [];

  const tried = new Set<string>();
  let lastError = "Gemini indisponible";
  let sawQuota = false;

  async function attempt(model: string, tier: GeminiTier): Promise<GeminiCallResult | null> {
    if (!model || tried.has(model)) return null;
    tried.add(model);
    console.log(`[${opts.logLabel}] Calling model:`, model, `(${tier})`);
    const started = Date.now();
    const budgetMs = tier === "pro" ? 120_000 : 75_000;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          signal: AbortSignal.timeout(budgetMs),
          body: JSON.stringify({
            contents: [{ role: "user", parts: opts.parts }],
            generationConfig: {
              temperature: opts.temperature,
              responseMimeType: "application/json",
              ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        console.error(`[${opts.logLabel}] FAIL:`, model, response.status, detail.slice(0, 220));
        lastError = `Gemini ${response.status}: ${detail.slice(0, 220)}`;
        if (response.status === 404) invalidateListedModels();
        if (isQuota(response.status, detail)) {
          sawQuota = true;
          await sleep(1500);
        }
        if (response.status === 503) await sleep(1200);
        if (response.status === 401 || response.status === 403) throw new Error(lastError);
        if (retryable(response.status)) return null;
        throw new Error(lastError);
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      const finish = payload.candidates?.[0]?.finishReason ?? "";
      if (!text) {
        lastError = finish === "MAX_TOKENS" ? "Réponse Gemini incomplète (MAX_TOKENS)" : "Réponse Gemini vide";
        console.error(`[${opts.logLabel}] FAIL:`, lastError, model);
        return null;
      }
      if (finish === "MAX_TOKENS" && !looksLikeJson(text)) {
        lastError = "Réponse Gemini incomplète (MAX_TOKENS)";
        console.warn(`[${opts.logLabel}] MAX_TOKENS JSON cassé`, model, `${text.length} chars`);
        return null;
      }
      if (finish === "MAX_TOKENS") {
        console.warn(`[${opts.logLabel}] MAX_TOKENS`, model, `${text.length} chars`);
      }
      console.log(`[${opts.logLabel}] OK:`, model, `${Date.now() - started}ms`, `${text.length} chars`);
      return { text, model, tier };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini indisponible";
      lastError = message;
      console.error(`[${opts.logLabel}] FAIL:`, model, message);
      if (/401|403|API_KEY|API key/i.test(message) && !/timeout|aborted/i.test(message)) {
        throw error instanceof Error ? error : new Error(message);
      }
      return null;
    }
  }

  for (const model of primary) {
    const hit = await attempt(model, opts.preferredTier);
    if (hit) return hit;
  }

  if (fallback.length > 0) {
    console.warn(
      `[${opts.logLabel}] ${opts.preferredTier} indisponible (${tried.size} essais) — fallback ${opts.fallbackTier}:`,
      fallback.join(", "),
    );
    for (const model of fallback) {
      const hit = await attempt(model, opts.fallbackTier ?? "flash");
      if (hit) {
        const warning = sawQuota
          ? "Quota Gemini Pro atteint — génération avec Gemini Flash."
          : "Gemini Pro indisponible — génération avec Gemini Flash.";
        return { ...hit, warning };
      }
    }
  }

  throw new Error(lastError);
}
