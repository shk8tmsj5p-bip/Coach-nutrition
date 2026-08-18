import { friendlyGeminiError, generateGeminiJson, type GeminiPart } from "@/lib/gemini/models";

/** @deprecated use friendlyGeminiError — kept so Tab 4 imports keep working. */
export function friendlyLlmWarning(raw?: string | null) {
  return friendlyGeminiError(raw);
}

export async function generateGeminiFlash(opts: {
  parts: GeminiPart[];
  temperature?: number;
}): Promise<string> {
  const result = await generateGeminiJson({
    preferredTier: "flash",
    parts: opts.parts,
    temperature: opts.temperature ?? 0.4,
    logLabel: "COACH GEN",
  });
  return result.text;
}
