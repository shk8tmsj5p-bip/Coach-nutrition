import { macrosFromPlanned, platLinesFromPlanned } from "@/lib/serve-week-plan";
import type { MealType, PlannedMeal, ProfileId } from "@/lib/types";

export type SwapProposal = {
  nom: string;
  calories: number;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  items: string[];
  theme: string;
  lowCalorie: boolean;
};

function p(
  nom: string,
  calories: number,
  proteines_g: number,
  glucides_g: number,
  lipides_g: number,
  items: string[],
  theme: string,
  lowCalorie = false,
): SwapProposal {
  return { nom, calories, proteines_g, glucides_g, lipides_g, items, theme, lowCalorie };
}

const ALEXIS: Record<MealType, SwapProposal[]> = {
  "petit-dejeuner": [
    p("Overnight oats soja, myrtilles, chia", 420, 24, 52, 14, ["Avoine 60g", "Lait soja", "Chia", "Myrtilles"], "Base"),
    p("Tofu scramble curcuma, pain complet", 440, 28, 38, 16, ["Tofu soyeux", "Pain complet", "Curcuma"], "Base"),
    p("Yaourt soja, granola, framboises", 390, 22, 44, 12, ["Yaourt soja", "Granola", "Framboises"], "Base"),
    p("Bruschetta tomate-basilic, tofu soyeux", 410, 22, 42, 14, ["Pain", "Tomate", "Basilic", "Tofu soyeux"], "Tomate"),
    p("Porridge espresso, cacao, amandes", 430, 20, 50, 14, ["Avoine", "Café", "Cacao", "Amandes"], "Italien"),
  ],
  dejeuner: [
    p("Bowl quinoa, légumes rôtis, tahini-citron, tofu frais", 690, 42, 72, 20, ["Quinoa", "Légumes", "Tahini", "Tofu frais"], "Base"),
    p("Wraps complets, falafels airfryer, houmous", 640, 34, 72, 18, ["Galette", "Falafels", "Houmous"], "Base"),
    p("Bo bun vermicelles, tofu mariné citron-gingembre", 670, 38, 78, 16, ["Vermicelles", "Crudités", "Tofu mariné"], "Asiatique"),
    p("Penne complète, sauce tomate basilic, lentilles", 720, 36, 88, 16, ["Penne", "Tomate", "Basilic", "Lentilles"], "Tomate"),
    p("Pasta e ceci, persil, zestes de citron", 700, 32, 90, 18, ["Pâtes", "Pois chiches", "Persil", "Citron"], "Italien"),
  ],
  diner: [
    p("Gazpacho andalou + toast complet houmous", 360, 18, 42, 12, ["Gazpacho", "Toast", "Houmous 40g"], "Tomate", true),
    p("Salade lentilles, concombre, feta végétale", 420, 26, 40, 14, ["Lentilles", "Concombre", "Feta végétale"], "Base", true),
    p("Soupe miso, pak choi, tofu soyeux, konjac", 390, 28, 32, 12, ["Miso", "Pak choi", "Tofu soyeux", "Konjac"], "Asiatique", true),
    p("Carpaccio de tomates, mozzarella vegan, basilic", 340, 16, 22, 18, ["Tomates", "Mozza vegan", "Basilic"], "Italien", true),
    p("Bowl concombre, edamame, riz vinaigré léger", 380, 22, 48, 8, ["Concombre", "Edamame", "Riz"], "Bowl", true),
  ],
  collation: [
    p("Yaourt soja + protein crunch cacao", 210, 22, 12, 8, ["Yaourt soja", "Protein crunch 25g"], "Base"),
    p("Tofu soyeux vanille, cacao", 190, 22, 8, 6, ["Tofu soyeux", "Cacao"], "Base"),
    p("Tomates cerises, houmous, bâtonnets de carotte", 180, 8, 16, 8, ["Tomates", "Houmous", "Carotte"], "Tomate"),
  ],
};

const ELODIE: Record<MealType, SwapProposal[]> = {
  "petit-dejeuner": [
    p("Skyr, granola maison, framboises", 380, 32, 38, 10, ["Skyr", "Granola", "Framboises"], "Base"),
    p("Œufs brouillés, pain complet, tomate", 410, 28, 32, 16, ["Œufs", "Pain", "Tomate"], "Tomate"),
    p("Fromage blanc 0%, miel, fraises", 320, 24, 36, 4, ["Fromage blanc", "Miel", "Fraises"], "Base"),
    p("Toast ricotta, tomate, basilic", 390, 22, 36, 14, ["Pain", "Ricotta", "Tomate", "Basilic"], "Italien"),
  ],
  dejeuner: [
    p("Bowl riz, poulet airfryer, edamame", 680, 52, 68, 18, ["Riz", "Poulet", "Edamame"], "Base"),
    p("Wraps complets, dinde, houmous", 610, 46, 58, 16, ["Galette", "Dinde", "Houmous"], "Base"),
    p("Penne complète, sauce tomate, dinde", 700, 48, 78, 16, ["Penne", "Tomate", "Dinde"], "Tomate"),
    p("Bo bun bœuf airfryer, vermicelles, menthe", 690, 49, 70, 18, ["Vermicelles", "Bœuf", "Menthe"], "Asiatique"),
    p("Pasta poulet citron, persil", 680, 46, 72, 16, ["Pâtes", "Poulet", "Citron", "Persil"], "Italien"),
  ],
  diner: [
    p("Gazpacho + toast ricotta et jambon", 380, 26, 36, 12, ["Gazpacho", "Toast", "Ricotta", "Jambon"], "Tomate", true),
    p("Salade lentilles, feta, thon", 450, 38, 36, 14, ["Lentilles", "Feta", "Thon"], "Base", true),
    p("Bouillon, vermicelles, crevettes", 360, 28, 28, 8, ["Bouillon", "Vermicelles", "Crevettes"], "Asiatique", true),
    p("Omelette blancs, épinards, tomate", 390, 34, 12, 18, ["Blancs d'œufs", "Épinards", "Tomate"], "Tomate", true),
    p("Bowl concombre, yaourt grec, poulet restes", 370, 32, 18, 12, ["Concombre", "Yaourt grec", "Poulet"], "Bowl", true),
  ],
  collation: [
    p("Fromage blanc 0% + fraises", 140, 18, 10, 1, ["Fromage blanc", "Fraises"], "Base"),
    p("Skyr, tomates cerises", 160, 20, 8, 2, ["Skyr", "Tomates cerises"], "Tomate"),
    p("Ricotta, concombre", 170, 14, 6, 8, ["Ricotta", "Concombre"], "Italien"),
  ],
};

export const SWAP_THEMES = ["Tomate", "Italien", "Asiatique", "Bowl", "Épicé"] as const;

export const SWAP_CATALOG: Record<ProfileId, Record<MealType, SwapProposal[]>> = {
  alexis: ALEXIS,
  elodie: ELODIE,
};

export function getSwapPool(
  profileId: ProfileId,
  mealType: MealType,
  theme: string | null,
): SwapProposal[] {
  const all = SWAP_CATALOG[profileId][mealType];
  if (!theme) return all;
  const themed = all.filter((item) => item.theme.toLowerCase() === theme.toLowerCase());
  if (themed.length > 0) return themed;
  return all.map((item) => ({
    ...item,
    nom: `${item.nom} — thème ${theme}`,
    theme,
  }));
}

export function pickSwapProposal(
  profileId: ProfileId,
  mealType: MealType,
  index: number,
  theme: string | null,
): SwapProposal {
  const pool = getSwapPool(profileId, mealType, theme);
  return pool[index % pool.length];
}

export function swapProposalsFromPlanned(
  meal: PlannedMeal,
  theme: string,
  mealType: MealType,
): Record<ProfileId, SwapProposal> {
  const lowCalorie = mealType === "diner" || meal.lowCalorie;
  const label = theme.trim() || meal.theme || "Base";
  const one = (id: ProfileId): SwapProposal => {
    const macros = macrosFromPlanned(meal, id);
    return {
      nom: meal.baseName,
      calories: macros.calories,
      proteines_g: macros.protein,
      glucides_g: macros.carbs,
      lipides_g: macros.fat,
      items: platLinesFromPlanned(meal, id),
      theme: label,
      lowCalorie,
    };
  };
  return { alexis: one("alexis"), elodie: one("elodie") };
}
