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
          "bg-blue-100 text-blue-700",
        "pre-production":
          "bg-yellow-100 text-yellow-700",
        production:
          "bg-green-100 text-green-700",
        "post-production":
          "bg-purple-100 text-purple-700",
        completed:
          "bg-gray-100 text-gray-700",
        "on-hold":
          "bg-orange-100 text-orange-700",
        // Scene status
        scheduled:
          "bg-blue-100 text-blue-700",
        "partially-shot":
          "bg-yellow-100 text-yellow-700",
        wrapped:
          "bg-green-100 text-green-700",
        cut:
          "bg-red-100 text-red-700",
        // INT/EXT
        int:
          "bg-indigo-100 text-indigo-700",
        ext:
          "bg-amber-100 text-amber-700",
        // Day/Night
        day:
          "bg-yellow-50 text-yellow-700",
        night:
          "bg-slate-700 text-slate-100",
        // Status
        success:
          "bg-green-100 text-green-700",
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
