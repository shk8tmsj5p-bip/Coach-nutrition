export type RecipeFit = "as-is" | "adapt";

export type RecipePhotoPayload = {
  mimeType: string;
  data: string;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.76;
const MAX_BYTES = 8 * 1024 * 1024;

export function isRecipeFit(value: unknown): value is RecipeFit {
  return value === "as-is" || value === "adapt";
}

export function parseRecipePhoto(raw: unknown): RecipePhotoPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const data = String(rec.data ?? rec.imageBase64 ?? "")
    .trim()
    .replace(/^data:[^;]+;base64,/, "");
  if (data.length < 80 || data.length > 1_800_000) return null;
  let mimeType = String(rec.mimeType ?? rec.mime ?? "image/jpeg").trim().toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) mimeType = "image/jpeg";
  return { mimeType, data };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const comma = text.indexOf(",");
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.onerror = () => reject(new Error("Lecture photo impossible"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Photo illisible"));
    };
    img.src = url;
  });
}

/** JPEG compressé pour rester sous la limite Vercel tout en restant lisible (livre, écran). */
export async function fileToRecipePhoto(file: File): Promise<RecipePhotoPayload> {
  if (!file || file.size === 0) throw new Error("Aucune photo");
  if (file.size > MAX_BYTES) throw new Error("Photo trop lourde (max 8 Mo).");
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("Compression photo impossible"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
    return { mimeType: "image/jpeg", data: await blobToBase64(blob) };
  } catch {
    const mime = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    return { mimeType: mime, data: await blobToBase64(file) };
  }
}

export function formatRecipePhotoForPrompt(fit: RecipeFit) {
  const shared = `PHOTO JOINTE = une recette (livre, écran, carte, notes manuscrites) OU un plat déjà dressé.
Lis le titre, les ingrédients, les quantités, les étapes, la sauce. Ce plat est pour Alexis ET Élodie (même recette, double déclinaison).
Si la photo est animale : Élodie garde cette protéine ; Alexis = équivalent vegan du MÊME rôle (tofu, légumineuses, falafel si c'est la star). INTERDIT deux plats différents.
Aversions : omets silencieusement. Sauces du commerce → explose en lignes maison au même goût.`;
  if (fit === "as-is") {
    return `${shared}

MODE TEL QUEL
Reproduis la recette photographiée, fidèle (star, sauce, technique, équilibre).
INTERDIT de la réécrire pour viser les kcal coach, INTERDIT de la transformer en dîner light, INTERDIT de changer la star ou le style.
PRIORITÉ ABSOLUE : ce MODE TEL QUEL écrase les blocs « PORTIONS COACH » et « dîners low cal » plus haut dans le prompt.
Garde les proportions relatives de la photo. JSON = 1 repas / personne (batch semaine : l'utilisateur cuisinera ×2).
visual_unit + grams_alexis / grams_elodie : même plat, split léger seulement si les quantités de la photo le permettent — sauces en dosage foyer unique.`;
  }
  return `${shared}

MODE RÉADAPTER
Garde le plat reconnaissable (titre, ingrédient star, sauce).
Réadapte à TOUS les critères foyer : COACH NUTRITION (grammes par profil), dîner low cal si soir, tofu semaine, prefs cuisine, matériel, stock si actif.
Même plat pour les deux.`;
}
