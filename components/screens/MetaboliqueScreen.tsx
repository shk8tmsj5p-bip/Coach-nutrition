"use client";

import { useProfile } from "@/context/ProfileContext";
import { CoachAnalysisCard } from "@/components/metabolique/CoachAnalysisCard";
import { EnergyBalanceCard } from "@/components/metabolique/EnergyBalanceCard";
import type { Profile } from "@/lib/types";

export default function MetaboliqueScreen() {
  const { activeProfiles } = useProfile();

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Métabolisme & Coaching</h1>
      <p className="mt-1 text-[13px] text-health-muted">
        Bilan 7 j et actions à appliquer cette semaine
      </p>

      {activeProfiles.map((profile) => (
        <ProfileMetabo key={profile.id} profile={profile} />
      ))}
    </div>
  );
}

function ProfileMetabo({ profile }: { profile: Profile }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-[17px] font-semibold">{profile.name}</h2>
      <EnergyBalanceCard profile={profile} />
      <CoachAnalysisCard profile={profile} />
    </section>
  );
}
