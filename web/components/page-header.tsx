"use client";

import * as React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  search?: React.ReactNode;
  filters?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  search,
  filters,
}: PageHeaderProps) {
  const hasSecondRow = search || filters || actions;

  return (
    <div className="shrink-0 bg-background">
      {/* Row 1: Title & Description */}
      <div className="flex items-center border-b px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <>
            <span className="mx-3 text-muted-foreground/40">|</span>
            <p className="text-sm text-muted-foreground">{description}</p>
          </>
        )}
      </div>

      {/* Row 2: Search, Filters, Actions */}
      {hasSecondRow && (
        <div className="flex items-center gap-3 border-b px-4 py-2">
          {search && <div className="flex-1">{search}</div>}
          {filters && <div className="flex items-center gap-2">{filters}</div>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
