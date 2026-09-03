import { Suspense } from "react";
import { UrgenceScreen } from "@/components/auth/UrgenceScreen";

export default function UrgencePage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-center text-[14px] text-health-muted">Chargement…</p>}>
      <UrgenceScreen />
    </Suspense>
  );
}
