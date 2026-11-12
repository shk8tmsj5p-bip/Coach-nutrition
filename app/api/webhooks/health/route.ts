import { NextResponse } from "next/server";
import { notifyAuthAlert } from "@/lib/auth/alerts";
import {
  HEALTH_WEBHOOK_PATH,
  isEmptyHealthPayload,
  isWebhookAuthorized,
  parseHealthPayload,
  parseHealthRequestBody,
} from "@/lib/health-webhook";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createAnonWebhookClient,
  createWebhookSupabaseClient,
  ingestHealthPayload,
} from "@/lib/supabase/health-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-webhook-secret, x-webhook-secret",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

async function readBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return parseHealthRequestBody(text);
  } catch {
    return {};
  }
}

function discovery() {
  return NextResponse.json(
    {
      ok: true,
      path: HEALTH_WEBHOOK_PATH,
      method: "GET ou POST",
      query:
        "?profile_id=alexis&steps=0&distance_km=0&cycling_distance_km=0&active_energy_kcal=0&resting_energy_kcal=0&weight_kg=0&fat_mass_pct=0&bmi=0",
      body: {
        steps: 0,
        active_energy_kcal: 0,
        resting_energy_kcal: 0,
        distance_km: 0,
        cycling_distance_km: 0,
        weight_kg: 0,
        fat_mass_pct: 0,
        bmi: 0,
        workouts: [{ activity: "Course", duration: 32, kcal: 280, date: "YYYY-MM-DD" }],
        profile_id: "alexis | elodie",
      },
    },
    { headers: corsHeaders },
  );
}

function rlsHint(error: string) {
  return /row-level security|permission denied|42501|rls/i.test(error);
}

function jwtHint(error: string) {
  return /invalid api key|jwt|jws|unauthorized|malformed/i.test(error);
}

function persistMessage(error: string) {
  if (rlsHint(error) || jwtHint(error)) {
    return "Enregistrement refusé. Vérifie SUPABASE_SERVICE_ROLE_KEY sur Vercel (le webhook iOS n’a pas de session foyer).";
  }
  if (/numeric|overflow|22P02/i.test(error)) {
    return "Une mesure Santé est hors limites (poids / IMC / %). Relance le raccourci.";
  }
  return "Impossible d’enregistrer les données Santé";
}

async function ingest(request: Request, body: unknown) {
  if (!isWebhookAuthorized(request, body)) {
    await notifyAuthAlert("health_webhook_denied", request);
    return NextResponse.json({ error: "Secret webhook invalide" }, { status: 401, headers: corsHeaders });
  }

  const payload = parseHealthPayload(body, new URL(request.url).searchParams);
  if (isEmptyHealthPayload(payload)) {
    return NextResponse.json(
      {
        error:
          "Payload vide — le raccourci doit envoyer steps, active_energy_kcal, resting_energy_kcal, distance_km, cycling_distance_km, weight_kg, fat_mass_pct, bmi ou workouts (query, JSON ou formulaire).",
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const admin = createAdminSupabaseClient();
  const supabase = admin ?? createWebhookSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503, headers: corsHeaders });
  }

  let result = await ingestHealthPayload(supabase, payload);
  if (!result.ok && admin) {
    const anon = createAnonWebhookClient();
    if (anon) {
      console.error("[HEALTH WEBHOOK] admin persist failed, retry anon:", result.error);
      result = await ingestHealthPayload(anon, payload);
    }
  }
  if (!result.ok) {
    console.error("[HEALTH WEBHOOK] persist failed:", result.error);
    return NextResponse.json(
      {
        error: persistMessage(result.error),
        detail: result.error.slice(0, 240),
      },
      { status: 500, headers: corsHeaders },
    );
  }

  console.log(
    `[HEALTH WEBHOOK] ${result.profile_id} ${result.date} steps=${result.steps ?? "—"} active=${result.active_energy_kcal ?? "—"} passive=${result.net_passive_kcal ?? "—"} kg=${result.weight_kg ?? "—"}`,
  );

  return NextResponse.json(result, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const body = await readBody(request);
  const probe = parseHealthPayload(body, new URL(request.url).searchParams);
  if (isEmptyHealthPayload(probe)) {
    const params = new URL(request.url).searchParams;
    if (params.get("profile_id") || params.get("profile") || params.get("secret")) {
      return ingest(request, body);
    }
    return discovery();
  }
  return ingest(request, body);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  return ingest(request, body);
}
