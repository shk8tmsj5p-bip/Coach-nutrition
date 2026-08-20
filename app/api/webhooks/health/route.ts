import { NextResponse } from "next/server";
import { HEALTH_WEBHOOK_PATH, isEmptyHealthPayload, isWebhookAuthorized, parseHealthPayload } from "@/lib/health-webhook";
import { createWebhookSupabaseClient, ingestHealthPayload } from "@/lib/supabase/health-logs";

export const runtime = "nodejs";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-webhook-secret, x-webhook-secret",
};

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { __invalid_json: true };
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

async function ingest(request: Request, body: unknown) {
  if (!isWebhookAuthorized(request, body)) {
    return NextResponse.json({ error: "Secret webhook invalide" }, { status: 401, headers: corsHeaders });
  }

  const payload = parseHealthPayload(body, new URL(request.url).searchParams);
  if (isEmptyHealthPayload(payload)) {
    return NextResponse.json(
      {
        error:
          "Payload vide — envoie steps, active_energy_kcal, resting_energy_kcal, distance_km, cycling_distance_km, weight_kg, fat_mass_pct, bmi ou workouts",
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const supabase = createWebhookSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503, headers: corsHeaders });
  }

  const result = await ingestHealthPayload(supabase, payload);
  if (!result.ok) {
    console.error("[HEALTH WEBHOOK] persist failed:", result.error);
    return NextResponse.json(
      { error: "Impossible d’enregistrer les données Santé" },
      { status: 500, headers: corsHeaders },
    );
  }

  console.log(
    `[HEALTH WEBHOOK] ${result.profile_id} ${result.date} steps=${result.steps ?? "—"} active=${result.active_energy_kcal ?? "—"} passive=${result.net_passive_kcal ?? "—"} kg=${result.weight_kg ?? "—"}`,
  );

  return NextResponse.json(result, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const probe = parseHealthPayload({}, new URL(request.url).searchParams);
  if (isEmptyHealthPayload(probe)) return discovery();
  return ingest(request, {});
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (body && typeof body === "object" && "__invalid_json" in body) {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: corsHeaders });
  }
  return ingest(request, body);
}
