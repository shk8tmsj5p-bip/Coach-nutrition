import { recipeTagClass } from "@/lib/plan-colors";
import { cn } from "@/lib/utils";

export function RecipeTag({
  recipeNo,
  className,
  compact,
  onClick,
}: {
  recipeNo: string;
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  const classes = cn(
    "inline-flex justify-center rounded-md font-bold tabular-nums",
    compact
      ? "min-w-[1.5rem] px-1 py-px text-[10px] leading-4"
      : "min-w-[2rem] px-1.5 py-0.5 text-[11px]",
    recipeTagClass(recipeNo),
    onClick && "cursor-pointer active:scale-95",
    className,
  );
  const label = recipeNo.replace(/^\[|\]$/g, "");
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {label}
      </button>
    );
  }
  return <span className={classes}>{label}</span>;
}
