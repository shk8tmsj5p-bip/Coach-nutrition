import type { AppliedAdjustments } from "@/lib/coach-adjustments";

export type ProfileId = "alexis" | "elodie";
export type ViewMode = ProfileId | "couple";

export type DietType = "vegan" | "omnivore";
export type MealType = "petit-dejeuner" | "dejeuner" | "diner" | "collation";
export type Appliance =
  | "Thermomix"
  | "Cookeo"
  | "Cuiseur à riz"
  | "Airfryer"
  | "Four"
  | "Plaque"
  | "KitchenAid";
export type WorkoutSource = "strava" | "apple-health";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type PrimaryGoal = "perte" | "maintien" | "prise";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SportActivity = "course" | "velo" | "muscu";
export type SportEffort =
  | "fractionne"
  | "sortie-longue"
  | "endurance"
  | "zone-2"
  | "circuit-hiit"
  | "force";

export type SportExerciseTarget = "reps" | "temps";

export interface SportExercise {
  id: string;
  name: string;
  sets: number;
  target: SportExerciseTarget;
  reps: number;
  workSec: number;
  restSec: number;
  /** Consigne libre (tempo, placement). */
  notes?: string;
}

export interface SportSession {
  id: string;
  activity: SportActivity;
  effort: SportEffort;
  durationMin: number;
  elevationM: number;
  exercises: SportExercise[];
  /** Séance commune Alexis & Élodie */
  shared: boolean;
  /** 1 = lundi … 7 = dimanche */
  weekdays: Weekday[];
}

export type MuscleGroup = "pecs" | "dos" | "jambes" | "epaules" | "bras" | "fessiers" | "abdos";

export type HypertrophyPrefs = {
  focus: MuscleGroup[];
  minutesPerSession: number;
  weekdays: Weekday[];
};

export type CardioActivity = "course" | "velo";

export type CardioSlot = {
  id: string;
  weekday: Weekday;
  activity: CardioActivity;
  durationMin: number;
  elevationM: number;
};

export type CardioPrefs = {
  slots: CardioSlot[];
};

export interface SportRoutine {
  runsPerWeek: number;
  ridesPerWeek: number;
  strengthDays: number;
  targetMinutesPerWeek: number;
  sessions: SportSession[];
  hypertrophy?: HypertrophyPrefs;
  cardio?: CardioPrefs;
}

export type SlotTemplateKind = "petit-dejeuner" | "collation" | "dessert-midi" | "dessert-soir";

export interface SlotTemplate {
  id: string;
  slot: SlotTemplateKind;
  name: string;
  items: string[];
  macros: Macros;
  /** 1 = lundi … 7 = dimanche */
  weekdays: Weekday[];
  time?: string;
}

export interface Profile {
  id: ProfileId;
  name: string;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  diet: DietType;
  aversions: string[];
  preferences: string[];
  startWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  primaryGoal: PrimaryGoal;
  weeklyRateKg: number;
  sportRoutine: SportRoutine;
  mealTemplates: SlotTemplate[];
  targets: Macros;
  bmr: number;
  tdee: number;
  accent: "coral" | "violet";
  appliedAdjustments?: AppliedAdjustments | null;
}

export interface MealEntry {
  id: string;
  name: string;
  type: MealType;
  time: string;
  macros: Macros;
  profileId: ProfileId;
  source: "plan" | "log" | "photo" | "barcode" | "text";
  items?: string[];
  isSkipped?: boolean;
  notes?: string;
  /** ISO YYYY-MM-DD. Present on loaded rows; inserts fall back to today. */
  date?: string;
}

export type QtyUnit = "g" | "ml" | "tranche" | "carreau" | "piece" | "cs" | "cc";

export interface DetectedIngredient {
  id: string;
  name: string;
  grams: number;
  qty?: number;
  unit?: QtyUnit;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

export interface Pesee {
  id: string;
  profileId: ProfileId;
  date: string;
  poids: number | null;
  masseGrasse: number | null;
  masseMusculaire: number | null;
  tourTaille: number | null;
  bmi: number | null;
  journalNotes: string | null;
}

export interface SundayJournalFields {
  mood: string;
  wins: string;
  blockers: string;
  hunger: number;
  energy: number;
  fatigue: number;
}

export interface WeightEntry {
  date: string;
  alexisKg: number;
  elodieKg: number;
  alexisFatPct?: number;
  elodieFatPct?: number;
  alexisMuscleKg?: number;
  elodieMuscleKg?: number;
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  type: string;
  durationMin: number;
  calories: number;
  source: WorkoutSource;
  profileId: ProfileId;
  intensity: "low" | "moderate" | "high";
}

/** Pas + énergie (Apple Santé). Les kcal sport viennent des séances dédiées (Strava / Watch). */
export interface DailyMovement {
  date: string;
  profileId: ProfileId;
  steps: number;
  /** Énergie active totale Apple Santé (inclut souvent les séances). */
  activeEnergyKcal: number;
  restingEnergyKcal: number;
  workoutMinutes: number;
  distanceKm: number;
  /** Distance vélo Apple Santé (séparée de la marche / course). */
  cyclingDistanceKm: number;
  weightKg?: number | null;
  fatMassPct?: number | null;
  bmi?: number | null;
  source: "apple-health";
}

export interface DailyCheckin {
  date: string;
  profileId: ProfileId;
  hunger: number;
  energy: number;
  fasting: boolean;
  notes?: string;
}

export interface RecipeDeclination {
  protein: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type IngredientRole = "shared" | "alexis" | "elodie";

export interface RecipeIngredient {
  id: string;
  name: string;
  role: IngredientRole;
  gramsAlexis: number;
  gramsElodie: number;
  /** Unité visuelle courses (`visual_unit` Gemini), ex. "2 pièces", "1/2 botte". */
  visualQuantity?: string;
  notes?: string;
}

export interface PlannedMeal {
  id: string;
  day: string;
  dayIndex: number;
  mealType: "dejeuner" | "diner";
  baseName: string;
  sharedBase: string;
  theme: string;
  appliances: Appliance[];
  servingsPerPerson: 1 | 2;
  batchId: string;
  coverLabel: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  tips: string[];
  cautions: string[];
  alexis: RecipeDeclination;
  elodie: RecipeDeclination;
  lowCalorie: boolean;
  weatherNote?: string;
}

export interface ShoppingAisle {
  aisle: string;
  items: string[];
}

export interface ShoppingListItem {
  id: string;
  name: string;
  aisle: string;
  quantityLabel: string;
  gramsAlexis: number;
  gramsElodie: number;
  visualQuantity?: string;
  planTags?: string[];
  notes?: string;
  custom?: boolean;
}

export interface BatchStepIngredient {
  name: string;
  quantity: string;
  visual?: string;
  planTag?: string;
  who?: string;
  gramsAlexis?: number;
  gramsElodie?: number;
  sauce?: boolean;
}

export interface BatchStepRecipeBlock {
  recipeNo: string;
  recipeTitle: string;
  coverLabel: string;
  ingredients: BatchStepIngredient[];
  action: string;
  setting?: string;
  servingsPerPerson?: 1 | 2;
}

export interface BatchStep {
  time: string;
  title: string;
  detail: string;
  appliance?: Appliance;
  setting?: string;
  recipes?: BatchStepRecipeBlock[];
  rowMode?: "per-item" | "sauce";
}

export interface MetabolicPoint {
  week: string;
  alexisWeight: number;
  elodieWeight: number;
  alexisAvgKcal: number;
  elodieAvgKcal: number;
}

export interface SundayJournalEntry {
  weekOf: string;
  alexis: { mood: string; wins: string; blockers: string };
  elodie: { mood: string; wins: string; blockers: string };
}

export interface CoachInsight {
  type: "plateau" | "recovery" | "flexibility" | "goal";
  title: string;
  message: string;
}
