import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full rounded-lg border border-ink-600 bg-ink-950/60 px-3 py-2 font-mono text-sm text-mist-100 placeholder:text-mist-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/40 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
