import { recipeTagClass } from "@/lib/plan-colors";
import { cn } from "@/lib/utils";

export function RecipeTag({
  recipeNo,
  className,
  compact,
}: {
  recipeNo: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex justify-center rounded-md font-bold tabular-nums",
        compact
          ? "min-w-[1.5rem] px-1 py-px text-[10px] leading-4"
          : "min-w-[2rem] px-1.5 py-0.5 text-[11px]",
        recipeTagClass(recipeNo),
        className,
      )}
    >
      {recipeNo.replace(/^\[|\]$/g, "")}
    </span>
  );
}
