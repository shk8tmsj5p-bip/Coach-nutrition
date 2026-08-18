"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { profiles as mockProfiles } from "@/lib/mock-data";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchProfils } from "@/lib/supabase/today-data";
import { storage } from "@/lib/storage";
import { overlayLocalGoals, saveAppliedAdjustments, saveProfileAversions, saveProfileGoals, saveProfileTargets, saveSportRoutines } from "@/lib/supabase/profil-goals";
import { hydrateKitchenPrefsFromSupabase } from "@/lib/supabase/parametres";
import type { GoalPatch } from "@/lib/goals";
import type { AppliedAdjustments } from "@/lib/coach-adjustments";
import type { Macros, Profile, ProfileId, SportRoutine, ViewMode } from "@/lib/types";

interface ProfileContextValue {
  view: ViewMode;
  setView: (view: ViewMode) => void;
  activeProfiles: Profile[];
  catalog: Record<ProfileId, Profile>;
  isCouple: boolean;
  accentFor: (id: ProfileId) => "coral" | "violet";
  fromSupabase: boolean;
  updateGoals: (profileId: ProfileId, patch: GoalPatch) => Promise<string | null>;
  updateSportRoutine: (profileId: ProfileId, routine: SportRoutine) => Promise<string | null>;
  updateSportRoutines: (
    routines: Partial<Record<ProfileId, SportRoutine>>,
  ) => Promise<string | null>;
  updateTargets: (profileId: ProfileId, targets: Macros) => Promise<string | null>;
  updateAppliedAdjustments: (
    profileId: ProfileId,
    adjustments: AppliedAdjustments | null,
  ) => Promise<string | null>;
  updateAversions: (profileId: ProfileId, aversions: string[]) => Promise<string | null>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<ViewMode>("alexis");
  const [catalog, setCatalog] = useState<Record<ProfileId, Profile>>(() =>
    overlayLocalGoals(mockProfiles),
  );
  const [fromSupabase, setFromSupabase] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = storage.get("view") as ViewMode | null;
    if (saved === "alexis" || saved === "elodie" || saved === "couple") {
      setViewState(saved);
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setHydrated(true);
      return;
    }

    fetchProfils(supabase)
      .then((rows) => {
        if (rows) {
          setCatalog(overlayLocalGoals(rows));
          setFromSupabase(true);
        }
      })
      .finally(() => setHydrated(true));
    void hydrateKitchenPrefsFromSupabase();
  }, []);

  const setView = useCallback((next: ViewMode) => {
    setViewState(next);
    storage.set("view", next);
  }, []);

  const updateGoals = useCallback(async (profileId: ProfileId, patch: GoalPatch) => {
    setCatalog((current) => ({
      ...current,
      [profileId]: { ...current[profileId], ...patch },
    }));
    return saveProfileGoals(profileId, patch);
  }, []);

  const updateSportRoutines = useCallback(
    async (routines: Partial<Record<ProfileId, SportRoutine>>) => {
      setCatalog((current) => {
        const next = { ...current };
        if (routines.alexis) next.alexis = { ...next.alexis, sportRoutine: routines.alexis };
        if (routines.elodie) next.elodie = { ...next.elodie, sportRoutine: routines.elodie };
        return next;
      });
      return saveSportRoutines(routines);
    },
    [],
  );

  const updateSportRoutine = useCallback(
    async (profileId: ProfileId, routine: SportRoutine) => {
      return updateSportRoutines({ [profileId]: routine });
    },
    [updateSportRoutines],
  );

  const updateTargets = useCallback(async (profileId: ProfileId, targets: Macros) => {
    setCatalog((current) => ({
      ...current,
      [profileId]: { ...current[profileId], targets },
    }));
    return saveProfileTargets(profileId, targets);
  }, []);

  const updateAppliedAdjustments = useCallback(
    async (profileId: ProfileId, adjustments: AppliedAdjustments | null) => {
      setCatalog((current) => ({
        ...current,
        [profileId]: { ...current[profileId], appliedAdjustments: adjustments },
      }));
      return saveAppliedAdjustments(profileId, adjustments);
    },
    [],
  );

  const updateAversions = useCallback(async (profileId: ProfileId, aversions: string[]) => {
    setCatalog((current) => ({
      ...current,
      [profileId]: { ...current[profileId], aversions },
    }));
    return saveProfileAversions(profileId, aversions);
  }, []);

  const value = useMemo<ProfileContextValue>(() => {
    const activeProfiles =
      view === "couple" ? [catalog.alexis, catalog.elodie] : [catalog[view]];
    return {
      view,
      setView,
      activeProfiles,
      catalog,
      isCouple: view === "couple",
      accentFor: (id) => catalog[id].accent,
      fromSupabase,
      updateGoals,
      updateSportRoutine,
      updateSportRoutines,
      updateTargets,
      updateAppliedAdjustments,
      updateAversions,
    };
  }, [
    view,
    setView,
    catalog,
    fromSupabase,
    updateGoals,
    updateSportRoutine,
    updateSportRoutines,
    updateTargets,
    updateAppliedAdjustments,
    updateAversions,
  ]);

  if (!hydrated) {
    return <div className="min-h-dvh bg-health-bg" />;
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
