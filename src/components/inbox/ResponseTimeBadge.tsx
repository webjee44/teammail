import { getResponseTimeTier, formatResponseTime } from "@/lib/response-time";
import { cn } from "@/lib/utils";

type Props = {
  minutes: number;
  variant?: "compact" | "full";
  className?: string;
};

export function ResponseTimeBadge({ minutes, variant = "compact", className }: Props) {
  const tier = getResponseTimeTier(minutes);
  const timeStr = formatResponseTime(minutes);

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", tier.color, className)}>
        <span>{tier.emoji}</span>
        <span>{timeStr}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", tier.bgColor, tier.color, className)}>
      <span>{tier.emoji}</span>
      <span>{timeStr}</span>
      <span className="opacity-70">·</span>
      <span>{tier.label}</span>
    </span>
  );
}
