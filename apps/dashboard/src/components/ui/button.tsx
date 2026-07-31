import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/50 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-mint-500 text-ink-950 hover:bg-mint-400 shadow-glow active:scale-[0.98]",
        secondary:
          "bg-ink-700 text-mist-100 border border-ink-600 hover:bg-ink-600 hover:border-mist-500/30",
        outline:
          "border border-ink-600 bg-transparent text-mist-100 hover:bg-ink-800 hover:border-mint-500/40",
        danger:
          "bg-coral-500/15 text-coral-400 border border-coral-500/30 hover:bg-coral-500/25",
        ghost: "text-mist-300 hover:text-mist-100 hover:bg-ink-800",
        success:
          "bg-mint-500/15 text-mint-400 border border-mint-500/30 hover:bg-mint-500/25",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
