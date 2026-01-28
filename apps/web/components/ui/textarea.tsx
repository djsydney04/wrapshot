import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-all duration-150",
          "placeholder:text-muted-foreground/50",
          "hover:border-foreground/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/20 focus-visible:ring-offset-0 focus-visible:border-accent-blue/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
