import { NextResponse } from "next/server";
import { alertsConfigured } from "@/lib/auth/alerts";
import { resolvedGeminiLabels } from "@/lib/gemini/models";

function present(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const labels = await resolvedGeminiLabels().catch(() => ({
    geminiPro: process.env.GEMINI_MODEL_PRO || "auto",
    geminiFlash: process.env.GEMINI_MODEL_FLASH || "auto",
  }));
  return NextResponse.json({
    gemini: present(process.env.GEMINI_API_KEY),
    geminiPro: labels.geminiPro,
    geminiFlash: labels.geminiFlash,
    strava: present(process.env.STRAVA_CLIENT_ID) && present(process.env.STRAVA_CLIENT_SECRET),
    stravaToken: present(process.env.STRAVA_REFRESH_TOKEN),
    healthWebhook: present(process.env.HEALTH_WEBHOOK_SECRET),
    supabase: present(process.env.NEXT_PUBLIC_SUPABASE_URL) && present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    alerts: alertsConfigured(),
  });
}
