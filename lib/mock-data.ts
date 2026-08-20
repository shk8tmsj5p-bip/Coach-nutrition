import { defaultRoutineFor } from "./sport-routine";
import { defaultMealTemplates } from "./meal-templates";
import type {
  BatchStep,
  CoachInsight,
  DailyCheckin,
  DetectedIngredient,
  MealEntry,
  MetabolicPoint,
  Profile,
  ProfileId,
  ShoppingAisle,
  DailyMovement,
  SundayJournalEntry,
  WeightEntry,
  Workout,
} from "./types";

export const TODAY = "2026-08-13";

export const profiles: Record<"alexis" | "elodie", Profile> = {
  alexis: {
    id: "alexis",
    name: "Alexis",
    heightCm: 185,
    age: 34,
    sex: "male",
    diet: "vegan",
    aversions: [
      "coriandre",
      "chou-fleur",
      "piment fort",
      "pastèque",
      "fenouil",
      "seitan",
      "tempeh",
    ],
    preferences: ["épicé", "saveurs complexes", "umami"],
    startWeightKg: 92.4,
    currentWeightKg: 82.1,
    targetWeightKg: 78.0,
    primaryGoal: "perte",
    weeklyRateKg: -0.5,
    sportRoutine: defaultRoutineFor("alexis"),
    mealTemplates: defaultMealTemplates("alexis"),
    targets: { calories: 2300, protein: 160, carbs: 240, fat: 70 },
    bmr: 1824,
    tdee: 2827,
    accent: "coral",
  },
  elodie: {
    id: "elodie",
    name: "Élodie",
    heightCm: 170,
    age: 32,
    sex: "female",
    diet: "omnivore",
    aversions: [
      "beurre de cacahuète",
      "chou-fleur",
      "piment fort",
      "mangue",
      "pastèque",
      "fenouil",
    ],
    preferences: ["frais", "herbes", "textures croquantes"],
    startWeightKg: 74.8,
    currentWeightKg: 67.6,
    targetWeightKg: 62.0,
    primaryGoal: "perte",
    weeklyRateKg: -0.5,
    sportRoutine: defaultRoutineFor("elodie"),
    mealTemplates: defaultMealTemplates("elodie"),
    targets: { calories: 1750, protein: 120, carbs: 170, fat: 55 },
    bmr: 1432,
    tdee: 2219,
    accent: "violet",
  },
};

export const todayMeals: MealEntry[] = [
  {
    id: "a-bf",
    name: "Overnight oats soja, myrtilles, graines de chia",
    type: "petit-dejeuner",
    time: "07:40",
    macros: { calories: 420, protein: 24, carbs: 52, fat: 14 },
    profileId: "alexis",
    source: "plan",
    items: ["Flocons d'avoine 60g", "Lait soja 200ml", "Chia 10g", "Myrtilles 80g"],
  },
  {
    id: "e-bf",
    name: "Skyr, granola maison, framboises",
    type: "petit-dejeuner",
    time: "07:55",
    macros: { calories: 380, protein: 32, carbs: 38, fat: 10 },
    profileId: "elodie",
    source: "plan",
    items: ["Skyr 200g", "Granola 30g", "Framboises 80g"],
  },
  {
    id: "a-lunch",
    name: "Bowl riz, tofu mariné, edamame, sauce satay douce",
    type: "dejeuner",
    time: "12:35",
    macros: { calories: 710, protein: 46, carbs: 78, fat: 22 },
    profileId: "alexis",
    source: "plan",
    items: ["Riz basmati 90g sec", "Tofu ferme 180g (frais)", "Edamame 80g", "Concombre", "Sauce satay 20g"],
  },
  {
    id: "e-lunch",
    name: "Bowl riz, poulet airfryer, edamame, sauce satay douce",
    type: "dejeuner",
    time: "12:35",
    macros: { calories: 680, protein: 52, carbs: 68, fat: 18 },
    profileId: "elodie",
    source: "plan",
    items: ["Riz basmati 80g sec", "Poulet 150g", "Edamame 80g", "Concombre", "Sauce satay 15g"],
  },
  {
    id: "a-snack",
    name: "Yaourt soja + 25g protein crunch",
    type: "collation",
    time: "16:10",
    macros: { calories: 210, protein: 22, carbs: 12, fat: 8 },
    profileId: "alexis",
    source: "barcode",
    items: ["Yaourt soja nature 150g", "Protein crunch 25g"],
  },
];

export const plannedDinnersToday = {
  alexis: {
    name: "Salade de lentilles, concombre, feta végétale, vinaigrette citron",
    macros: { calories: 480, protein: 32, carbs: 48, fat: 16 },
    note: "Dîner low calorie · tofu mariné",
  },
  elodie: {
    name: "Salade de lentilles, concombre, feta, thon, vinaigrette citron",
    macros: { calories: 450, protein: 38, carbs: 36, fat: 14 },
    note: "Dîner low calorie",
  },
};

export const suggestedSnacks = {
  alexis: {
    name: "Tofu soyeux vanille + cacao + 10g whey vegan",
    macros: { calories: 190, protein: 22, carbs: 8, fat: 6 },
    remainingAfterDinner: { calories: 480, protein: 36 },
  },
  elodie: {
    name: "Fromage blanc 0% + 80g fraises",
    macros: { calories: 140, protein: 18, carbs: 10, fat: 1 },
    remainingAfterDinner: { calories: 240, protein: 18 },
  },
};

export const todayMovement: Record<ProfileId, DailyMovement> = {
  alexis: {
    date: TODAY,
    profileId: "alexis",
    steps: 8432,
    activeEnergyKcal: 740,
    restingEnergyKcal: 1824,
    workoutMinutes: 52,
    distanceKm: 6.4,
    cyclingDistanceKm: 28.4,
    weightKg: 82.1,
    fatMassPct: 21.3,
    bmi: 24.0,
    source: "apple-health",
  },
  elodie: {
    date: TODAY,
    profileId: "elodie",
    steps: 11240,
    activeEnergyKcal: 518,
    restingEnergyKcal: 1432,
    workoutMinutes: 32,
    distanceKm: 8.1,
    cyclingDistanceKm: 0,
    weightKg: 67.6,
    fatMassPct: 27.2,
    bmi: 23.4,
    source: "apple-health",
  },
};

export const todayWorkouts: Workout[] = [
  {
    id: "w-a-1",
    date: TODAY,
    name: "Vélo route — Boucle Marne",
    type: "Ride",
    durationMin: 52,
    calories: 428,
    source: "strava",
    profileId: "alexis",
    intensity: "moderate",
  },
  {
    id: "w-e-1",
    date: TODAY,
    name: "Course facile — Parc",
    type: "Run",
    durationMin: 32,
    calories: 276,
    source: "strava",
    profileId: "elodie",
    intensity: "moderate",
  },
];

export const recentHighIntensity: Workout[] = [
  {
    id: "w-a-hi",
    date: "2026-08-12",
    name: "Seuil vélo",
    type: "Ride",
    durationMin: 75,
    calories: 690,
    source: "strava",
    profileId: "alexis",
    intensity: "high",
  },
];

export const todayCheckins: DailyCheckin[] = [
  { date: TODAY, profileId: "alexis", hunger: 3, energy: 4, fasting: false },
  { date: TODAY, profileId: "elodie", hunger: 2, energy: 4, fasting: false },
];

function buildWeightHistory(): WeightEntry[] {
  const start = new Date("2026-07-15");
  const entries: WeightEntry[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const t = i / 29;
    const wobbleA = Math.sin(i / 2.4) * 0.18 + (i > 20 && i < 28 ? 0.12 : 0);
    const wobbleE = Math.cos(i / 2.1) * 0.14 + (i > 20 && i < 28 ? 0.08 : 0);
    entries.push({
      date: d.toISOString().slice(0, 10),
      alexisKg: Number((83.6 - t * 1.5 + wobbleA).toFixed(1)),
      elodieKg: Number((68.8 - t * 1.2 + wobbleE).toFixed(1)),
      alexisFatPct: Number((22.4 - t * 1.1 + wobbleA * 0.3).toFixed(1)),
      elodieFatPct: Number((28.6 - t * 1.4 + wobbleE * 0.3).toFixed(1)),
      alexisMuscleKg: Number((62.1 + t * 0.4).toFixed(1)),
      elodieMuscleKg: Number((44.8 + t * 0.25).toFixed(1)),
    });
  }
  return entries;
}

export const weightHistory = buildWeightHistory();

export const latestBodyComp = weightHistory[weightHistory.length - 1];

export { weeklyPlan } from "./weekly-plan-seed";

export const shoppingList: ShoppingAisle[] = [
  {
    aisle: "FRUITS & LÉGUMES",
    items: [
      "Courgettes 6",
      "Poivrons 4",
      "Concombres 5",
      "Tomates grappe 1kg",
      "Pak choi 2",
      "Épinards 400g",
      "Roquette 150g",
      "Carottes 1kg",
      "Oignons rouges 4",
      "Avocats 2",
      "Patates douces 800g",
      "Citron 6",
      "Myrtilles 250g",
      "Framboises 125g",
      "Fraises 250g",
    ],
  },
  {
    aisle: "FRAIS / RAYON BIO",
    items: [
      "Tofu ferme 800g (NE PAS CUIRE AU BATCH — marinade fraîche)",
      "Tofu soyeux 400g",
      "Lait soja 2L",
      "Yaourt soja nature 8 pots",
      "Feta végétale 200g",
      "Skyr 1kg",
      "Fromage blanc 0% 500g",
      "Feta 200g",
      "Mozzarella 125g",
      "Ricotta 250g",
      "Œufs 12",
    ],
  },
  {
    aisle: "VIANDES & POISSONS",
    items: [
      "Filets de poulet 800g (Élodie, 2 portions × 2 repas)",
      "Dinde 400g",
      "Bœuf à sauter 300g",
      "Crevettes 300g",
      "Thon naturel 4 boîtes",
      "Jambon blanc 4 tranches",
    ],
  },
  {
    aisle: "ÉPICERIE SALÉE",
    items: [
      "Riz basmati 1kg",
      "Quinoa 500g",
      "Lentilles 500g",
      "Lentilles corail 250g",
      "Pois chiches 2 boîtes",
      "Edamame surgelés 500g",
      "Nouilles de konjac 2",
      "Vermicelles de riz 250g",
      "Penne complète 500g",
      "Naan 4",
      "Houmous 2 pots ou pois chiches + tahini",
      "Tahini 1",
      "Miso 1",
      "Sauce tomate 700g",
    ],
  },
  {
    aisle: "PETIT-DÉJEUNER",
    items: [
      "Flocons d'avoine 500g",
      "Graines de chia 1",
      "Granola 1",
      "Cacao non sucré 1",
    ],
  },
  {
    aisle: "SURGELÉS",
    items: ["Edamame 500g", "Épinards hachés 400g", "Framboises 300g"],
  },
];

export const shoppingListPlainText = shoppingList
  .map((group) => `${group.aisle}\n${group.items.join("\n")}`)
  .join("\n\n");

export const batchGuide: BatchStep[] = [
  {
    time: "0:00",
    title: "Mise en place",
    detail:
      "Laver légumes, peser les féculents, lancer riz Cookeo + quinoa. Presser le tofu pour la marinade.",
    appliance: "Cookeo",
  },
  {
    time: "0:10",
    title: "Protéines Élodie",
    detail:
      "Poulet et dinde assaisonnés → Airfryer 18 min. Bœuf en second batch. 2 portions × 2 repas chacune.",
    appliance: "Airfryer",
  },
  {
    time: "0:15",
    title: "Légumes rôtis",
    detail: "Courgette, poivron, oignon, patate douce au four 200°C 25 min.",
    appliance: "Four",
  },
  {
    time: "0:20",
    title: "Sauces Thermomix",
    detail: "Tahini-citron, satay douce (sans piment fort), gazpacho, houmous épicé doux. Pas de coriandre.",
    appliance: "Thermomix",
  },
  {
    time: "0:40",
    title: "Légumineuses",
    detail: "Lentilles Cookeo. Falafels façonnés → Airfryer 12 min. Pois chiches croustillants.",
    appliance: "Cookeo",
  },
  {
    time: "0:50",
    title: "Marinade tofu",
    detail: "Presser le tofu, mariner sésame / citron-gingembre, réserver au frais. Dresser froid.",
  },
  {
    time: "1:10",
    title: "Portionnage",
    detail:
      "Boîtes repas × 2 par personne et par recette cuite. Dîners low cal à part.",
  },
  {
    time: "1:25",
    title: "Finitions",
    detail: "Herbes ciselées, pickles, vinaigrettes en pots.",
  },
];

export const metabolicHistory: MetabolicPoint[] = [
  { week: "S22", alexisWeight: 86.2, elodieWeight: 71.4, alexisAvgKcal: 2480, elodieAvgKcal: 1880 },
  { week: "S23", alexisWeight: 85.4, elodieWeight: 70.8, alexisAvgKcal: 2410, elodieAvgKcal: 1840 },
  { week: "S24", alexisWeight: 84.7, elodieWeight: 70.1, alexisAvgKcal: 2380, elodieAvgKcal: 1810 },
  { week: "S25", alexisWeight: 84.1, elodieWeight: 69.6, alexisAvgKcal: 2360, elodieAvgKcal: 1790 },
  { week: "S26", alexisWeight: 83.6, elodieWeight: 69.1, alexisAvgKcal: 2340, elodieAvgKcal: 1780 },
  { week: "S27", alexisWeight: 83.2, elodieWeight: 68.6, alexisAvgKcal: 2320, elodieAvgKcal: 1760 },
  { week: "S28", alexisWeight: 82.8, elodieWeight: 68.2, alexisAvgKcal: 2310, elodieAvgKcal: 1750 },
  { week: "S29", alexisWeight: 82.4, elodieWeight: 67.9, alexisAvgKcal: 2300, elodieAvgKcal: 1740 },
  { week: "S30", alexisWeight: 82.2, elodieWeight: 67.7, alexisAvgKcal: 2290, elodieAvgKcal: 1750 },
  { week: "S31", alexisWeight: 82.1, elodieWeight: 67.6, alexisAvgKcal: 2285, elodieAvgKcal: 1760 },
];

export const sundayJournal: SundayJournalEntry = {
  weekOf: "2026-08-10",
  alexis: {
    mood: "Stable, un peu de faim le soir",
    wins: "4 sorties vélo, protéines tenues 4/7",
    blockers: "Dîner resto mercredi (+450 kcal) — à lisser -100 kcal × 4 j",
  },
  elodie: {
    mood: "Bonne énergie, sommeil OK",
    wins: "3 runs, hydratation, 0 snacking tardif",
    blockers: "Plateau balance 4 jours — patience, moyenne 14j encore descendante",
  },
};

export const coachInsights: Record<"alexis" | "elodie", CoachInsight[]> = {
  alexis: [
    {
      type: "recovery",
      title: "Récupération",
      message:
        "Séance seuil hier (75 min, haute intensité). Aujourd'hui : vélo endurance ou repos. Pas de HIIT.",
    },
    {
      type: "flexibility",
      title: "Lissage resto",
      message: "Excédent mercredi lissé : −100 kcal/j jusqu'à dimanche. Cible du jour 2200 kcal.",
    },
    {
      type: "goal",
      title: "Tolérance ±5%",
      message: "Objectif atteint si tu termines entre 2185 et 2415 kcal.",
    },
  ],
  elodie: [
    {
      type: "plateau",
      title: "Plateau 7 jours",
      message:
        "Moyenne 7j quasi plate. Moyenne 14j encore −0,2 kg/sem. Option : −150 kcal ou +1000 pas. Pas d'urgence.",
    },
    {
      type: "recovery",
      title: "Charge",
      message: "Run facile aujourd'hui, c'est parfait. Sortie outdoor vélo possible demain si jambes OK.",
    },
    {
      type: "goal",
      title: "Tolérance ±5%",
      message: "Objectif atteint entre 1663 et 1838 kcal.",
    },
  ],
};

export const mockPhotoIngredients: DetectedIngredient[] = [
  { id: "i1", name: "Riz basmati cuit", grams: 220, calories: 286, protein: 6 },
  { id: "i2", name: "Tofu ferme", grams: 160, calories: 230, protein: 25 },
  { id: "i3", name: "Edamame", grams: 80, calories: 96, protein: 9 },
  { id: "i4", name: "Huile de sésame", grams: 8, calories: 72, protein: 0 },
  { id: "i5", name: "Avocat (IA incertaine)", grams: 40, calories: 64, protein: 1 },
];

export const mockBarcodeProduct = {
  name: "Protein Crunch — Saveur cacao",
  brand: "Decathlon",
  barcode: "3608412345678",
  servingG: 25,
  packG: 250,
  macros: { calories: 98, protein: 13, carbs: 4, fat: 3 },
};
