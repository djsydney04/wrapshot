"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function Header({ title, breadcrumbs, actions, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-12 items-center justify-between border-b border-border/85 bg-background/65 px-4 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title (if no breadcrumbs) */}
        {!breadcrumbs && title && (
          <h1 className="text-sm font-medium">{title}</h1>
        )}
      </div>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
