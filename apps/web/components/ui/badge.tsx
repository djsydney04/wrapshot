import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary",
        secondary:
          "bg-secondary text-secondary-foreground",
        destructive:
          "bg-destructive/10 text-destructive",
        outline:
          "border border-current bg-transparent",
        // Film production status variants
        development:
          "bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-fg))]",
        "pre-production":
          "bg-[hsl(var(--badge-yellow))] text-[hsl(var(--badge-yellow-fg))]",
        production:
          "bg-[hsl(var(--badge-green))] text-[hsl(var(--badge-green-fg))]",
        "post-production":
          "bg-[hsl(var(--badge-purple))] text-[hsl(var(--badge-purple-fg))]",
        completed:
          "bg-[hsl(var(--badge-gray))] text-[hsl(var(--badge-gray-fg))]",
        "on-hold":
          "bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-fg))]",
        // Scene status
        scheduled:
          "bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-fg))]",
        "partially-shot":
          "bg-[hsl(var(--badge-yellow))] text-[hsl(var(--badge-yellow-fg))]",
        wrapped:
          "bg-[hsl(var(--badge-green))] text-[hsl(var(--badge-green-fg))]",
        cut:
          "bg-[hsl(var(--badge-red))] text-[hsl(var(--badge-red-fg))]",
        // INT/EXT
        int:
          "bg-[hsl(var(--badge-indigo))] text-[hsl(var(--badge-indigo-fg))]",
        ext:
          "bg-[hsl(var(--badge-amber))] text-[hsl(var(--badge-amber-fg))]",
        // Day/Night
        day:
          "bg-[hsl(var(--badge-yellow))] text-[hsl(var(--badge-yellow-fg))]",
        night:
          "bg-[hsl(var(--badge-slate))] text-[hsl(var(--badge-slate-fg))]",
        // Status
        success:
          "bg-[hsl(var(--badge-green))] text-[hsl(var(--badge-green-fg))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
