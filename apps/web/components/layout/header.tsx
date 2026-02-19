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
        "flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border/85 bg-background/65 px-3 py-2 backdrop-blur-xl sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm whitespace-nowrap">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="max-w-[9rem] truncate text-muted-foreground transition-colors hover:text-foreground sm:max-w-none"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-none">
                    {item.label}
                  </span>
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
      {actions && <div className="flex w-full items-center justify-end gap-2 sm:w-auto">{actions}</div>}
    </header>
  );
}
