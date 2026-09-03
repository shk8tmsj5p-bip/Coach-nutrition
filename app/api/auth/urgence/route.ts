import { NextResponse } from "next/server";
import { hashPasswordHex, loadFoyerLock, markUrgenceUsed, passwordStrengthError, replaceFoyerPassword } from "@/lib/auth/foyer-lock";
import { readUrgenceToken } from "@/lib/auth/urgence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("k") ?? "";
  const payload = await readUrgenceToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Lien expiré ou invalide (48 h)." }, { status: 400 });
  }
  const lock = await loadFoyerLock();
  const used = lock.urgence_used && (await hashPasswordHex(token)) === lock.urgence_used;
  if (used) {
    return NextResponse.json({ error: "Ce lien a déjà servi. Ouvre l’app ou attends un nouveau mail." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, kind: payload.kind });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
    confirm?: string;
  } | null;
  const token = body?.token ?? "";
  const payload = await readUrgenceToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Lien expiré ou invalide (48 h)." }, { status: 400 });
  }
  const lock = await loadFoyerLock();
  const tokenHash = await hashPasswordHex(token);
  if (lock.urgence_used && lock.urgence_used === tokenHash) {
    return NextResponse.json({ error: "Ce lien a déjà servi." }, { status: 400 });
  }
  const password = body?.password ?? "";
  const weak = passwordStrengthError(password);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  if (password !== (body?.confirm ?? "")) {
    return NextResponse.json({ error: "Les deux codes ne sont pas pareils." }, { status: 400 });
  }
  const { error } = await replaceFoyerPassword(password);
  if (error) return NextResponse.json({ error }, { status: 503 });
  await markUrgenceUsed(tokenHash);
  return NextResponse.json({ ok: true });
}
