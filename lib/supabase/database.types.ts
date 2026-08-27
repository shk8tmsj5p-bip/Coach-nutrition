export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileId = "alexis" | "elodie";
export type MealType = "petit-dejeuner" | "dejeuner" | "diner" | "collation";
export type MealSource = "plan" | "log" | "photo" | "barcode" | "text";
export type HealthKind = "poids" | "composition" | "checkin" | "activite" | "journal";
export type HealthSource = "manual" | "renpho_ocr" | "webhook" | "strava" | "apple_health";

export interface Database {
  public: {
    Tables: {
      profils: {
        Row: {
          id: ProfileId;
          display_name: string;
          height_cm: number;
          age: number;
          sex: "male" | "female";
          diet: "vegan" | "omnivore";
          aversions: string[];
          preferences: string[];
          start_weight_kg: number;
          current_weight_kg: number;
          target_weight_kg: number;
          primary_goal: "perte" | "maintien" | "prise";
          weekly_rate_kg: number;
          sport_routine: Json;
          meal_templates: Json;
          applied_adjustments: Json | null;
          target_calories: number;
          target_protein_g: number;
          target_carbs_g: number;
          target_fat_g: number;
          bmr: number;
          tdee: number;
          accent: "coral" | "violet";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: ProfileId;
          display_name: string;
          height_cm: number;
          age: number;
          sex: "male" | "female";
          diet: "vegan" | "omnivore";
          aversions?: string[];
          preferences?: string[];
          start_weight_kg: number;
          current_weight_kg: number;
          target_weight_kg: number;
          primary_goal?: "perte" | "maintien" | "prise";
          weekly_rate_kg?: number;
          sport_routine?: Json;
          meal_templates?: Json;
          applied_adjustments?: Json | null;
          target_calories: number;
          target_protein_g: number;
          target_carbs_g: number;
          target_fat_g: number;
          bmr: number;
          tdee: number;
          accent: "coral" | "violet";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profils"]["Insert"]>;
        Relationships: [];
      };
      repas: {
        Row: {
          id: string;
          profile_id: ProfileId;
          group_id: string | null;
          date: string;
          heure: string | null;
          type: MealType;
          nom: string;
          base_partagee: string | null;
          proteine: string | null;
          items: Json;
          calories: number;
          proteines_g: number;
          glucides_g: number;
          lipides_g: number;
          source: MealSource;
          is_planned: boolean;
          low_calorie: boolean;
          appliances: string[];
          notes: string | null;
          is_skipped: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: ProfileId;
          group_id?: string | null;
          date?: string;
          heure?: string | null;
          type: MealType;
          nom: string;
          base_partagee?: string | null;
          proteine?: string | null;
          items?: Json;
          calories?: number;
          proteines_g?: number;
          glucides_g?: number;
          lipides_g?: number;
          source?: MealSource;
          is_planned?: boolean;
          low_calorie?: boolean;
          appliances?: string[];
          notes?: string | null;
          is_skipped?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["repas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "repas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profils";
            referencedColumns: ["id"];
          },
        ];
      };
      logs_sante: {
        Row: {
          id: string;
          profile_id: ProfileId;
          logged_at: string;
          date: string;
          kind: HealthKind;
          source: HealthSource;
          weight_kg: number | null;
          fat_pct: number | null;
          muscle_kg: number | null;
          water_pct: number | null;
          hunger: number | null;
          energy: number | null;
          fasting: boolean | null;
          notes: string | null;
          activity_name: string | null;
          activity_type: string | null;
          duration_min: number | null;
          calories_burned: number | null;
          intensity: "low" | "moderate" | "high" | null;
          external_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: ProfileId;
          logged_at?: string;
          date?: string;
          kind: HealthKind;
          source?: HealthSource;
          weight_kg?: number | null;
          fat_pct?: number | null;
          muscle_kg?: number | null;
          water_pct?: number | null;
          hunger?: number | null;
          energy?: number | null;
          fasting?: boolean | null;
          notes?: string | null;
          activity_name?: string | null;
          activity_type?: string | null;
          duration_min?: number | null;
          calories_burned?: number | null;
          intensity?: "low" | "moderate" | "high" | null;
          external_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["logs_sante"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "logs_sante_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profils";
            referencedColumns: ["id"];
          },
        ];
      };
      parametres: {
        Row: {
          id: "foyer";
          batch_weekday: string;
          batch_time: string;
          dinners_low_calorie: boolean;
          tofu_never_cooked_in_batch: boolean;
          rule_80_20: boolean;
          snacks_no_cook: boolean;
          weather_note: string | null;
          gemini_model_pro: string;
          gemini_model_flash: string;
          strava_athlete_id: string | null;
          health_webhook_enabled: boolean;
          kitchen_prefs: Json;
          favorite_recipes: Json;
          rejected_recipes: Json;
          pantry_stock: Json;
          updated_at: string;
        };
        Insert: {
          id?: "foyer";
          batch_weekday?: string;
          batch_time?: string;
          dinners_low_calorie?: boolean;
          tofu_never_cooked_in_batch?: boolean;
          rule_80_20?: boolean;
          snacks_no_cook?: boolean;
          weather_note?: string | null;
          gemini_model_pro?: string;
          gemini_model_flash?: string;
          strava_athlete_id?: string | null;
          health_webhook_enabled?: boolean;
          kitchen_prefs?: Json;
          favorite_recipes?: Json;
          rejected_recipes?: Json;
          pantry_stock?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametres"]["Insert"]>;
        Relationships: [];
      };
      plans_semaine: {
        Row: {
          week_start: string;
          theme: string | null;
          meals: Json;
          lunch_dessert?: Json | null;
          updated_at: string;
        };
        Insert: {
          week_start: string;
          theme?: string | null;
          meals?: Json;
          lunch_dessert?: Json | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plans_semaine"]["Insert"]>;
        Relationships: [];
      };
      pesees: {
        Row: {
          id: string;
          profile_id: ProfileId;
          date: string;
          poids: number | null;
          masse_grasse: number | null;
          masse_musculaire: number | null;
          tour_taille: number | null;
          journal_notes: string | null;
          bmi: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: ProfileId;
          date?: string;
          poids?: number | null;
          masse_grasse?: number | null;
          masse_musculaire?: number | null;
          tour_taille?: number | null;
          journal_notes?: string | null;
          bmi?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pesees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "pesees_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profils";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ProfilRow = Database["public"]["Tables"]["profils"]["Row"];
export type RepasRow = Database["public"]["Tables"]["repas"]["Row"];
export type LogSanteRow = Database["public"]["Tables"]["logs_sante"]["Row"];
export type ParametresRow = Database["public"]["Tables"]["parametres"]["Row"];
export type PlanSemaineRow = Database["public"]["Tables"]["plans_semaine"]["Row"];
export type PeseeRow = Database["public"]["Tables"]["pesees"]["Row"];
