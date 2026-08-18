import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  compact,
}: {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-card bg-health-card text-left shadow-card",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between px-0.5", className ?? "mb-2 mt-5")}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-health-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}
