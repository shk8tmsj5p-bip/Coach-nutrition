import { Card, SectionTitle } from "@/components/ui/Card";
import type { TodayCoachRemark } from "@/lib/today-coach";
import { cn } from "@/lib/utils";

export function TodayDayCoach({ remark }: { remark: TodayCoachRemark | null }) {
  if (!remark) return null;
  const tone =
    remark.tone === "warn"
      ? "text-amber-800 dark:text-amber-200"
      : remark.tone === "go"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-health-ink";
  return (
    <>
      <SectionTitle>Coach du jour</SectionTitle>
      <Card className={cn(remark.tone === "warn" && "border border-amber-200 dark:border-amber-900")}>
        <p className={cn("text-[15px] font-semibold", tone)}>{remark.title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-health-ink">{remark.message}</p>
      </Card>
    </>
  );
}
