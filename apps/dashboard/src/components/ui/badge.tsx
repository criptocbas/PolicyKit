import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "danger" | "warn" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        variant === "default" && "bg-ink-700 text-mist-300",
        variant === "success" && "bg-mint-500/15 text-mint-400 ring-1 ring-mint-500/25",
        variant === "danger" && "bg-coral-500/15 text-coral-400 ring-1 ring-coral-500/25",
        variant === "warn" && "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
        variant === "muted" && "bg-ink-800 text-mist-400",
        className
      )}
      {...props}
    />
  );
}
