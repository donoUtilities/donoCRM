"use client";

import * as React from "react";
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------- Types ---------- */

export type ColumnType = "text" | "number" | "date" | "badge" | "bool" | "dollar";

export interface ColumnDef<T> {
  label: string;
  key: (keyof T & string) | (string & {});
  type?: ColumnType;
  /** Fixed column width, e.g. "180px" */
  width?: string;
}

type SortDir = "asc" | "desc" | null;

export interface DataTableProps<T extends { _id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  onLoadMore: () => void;
  /** Icon shown when table is empty */
  emptyIcon?: React.ReactNode;
  /** Message shown when table is empty */
  emptyMessage?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Custom cell renderer (overrides default). Return undefined to use default. */
  renderCell?: (row: T, col: ColumnDef<T>) => React.ReactNode | undefined;
  /** Optional footer/totals row — map of column key to rendered content */
  footerRow?: Record<string, React.ReactNode>;
  /** Enable checkbox row selection */
  selectable?: boolean;
  /** Set of selected row _id values (controlled) */
  selectedIds?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (ids: Set<string>) => void;
}

/* ---------- Helpers ---------- */

function statusVariant(
  s: string
): "default" | "secondary" | "destructive" | "outline" {
  const l = (s || "").toLowerCase();
  if (["complete", "completed", "invoiced", "tested", "yes"].includes(l)) return "default";
  if (["incomplete", "pending", "partial"].includes(l)) return "secondary";
  if (["failed", "rejected", "no"].includes(l)) return "destructive";
  return "outline";
}

function formatDate(ts: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ts;
  }
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") return <IconArrowUp className="inline size-3 ml-1" />;
  if (dir === "desc") return <IconArrowDown className="inline size-3 ml-1" />;
  return <IconArrowsSort className="inline size-3 ml-1 opacity-30" />;
}

/* ---------- Default cell renderer ---------- */

function defaultRenderCell<T>(value: unknown, col: ColumnDef<T>): React.ReactNode {
  const v = value;

  if (col.type === "date") {
    return (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDate(v as string)}
      </span>
    );
  }

  if (col.type === "number") {
    return (
      <span className="whitespace-nowrap tabular-nums">
        {v != null ? Number(v).toLocaleString() : "—"}
      </span>
    );
  }

  if (col.type === "dollar") {
    if (v === null || v === undefined || v === "") return <span className="whitespace-nowrap tabular-nums">—</span>;
    const n = Number(v);
    if (isNaN(n)) return <span className="whitespace-nowrap tabular-nums">—</span>;
    return (
      <span className="whitespace-nowrap tabular-nums">
        {n.toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </span>
    );
  }

  if (col.type === "bool") {
    return (
      <Badge variant={v === true ? "default" : v === false ? "destructive" : "secondary"}>
        {v === true ? "Yes" : v === false ? "No" : "—"}
      </Badge>
    );
  }

  if (col.type === "badge") {
    return (
      <Badge variant={statusVariant(v as string)}>
        {(v as string) || "—"}
      </Badge>
    );
  }

  return (
    <span className="whitespace-nowrap">
      {v != null && v !== "" ? String(v) : "—"}
    </span>
  );
}

/* ---------- Component ---------- */

export function DataTable<T extends { _id: string }>({
  columns,
  data,
  loading,
  loadingMore,
  hasMore,
  totalCount,
  onLoadMore,
  emptyIcon,
  emptyMessage = "No records found",
  onRowClick,
  renderCell,
  footerRow,
  selectable,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [data, sortKey, sortDir]);

  // Infinite scroll observer
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, onLoadMore]);

  // Selection helpers
  const isSelectable = selectable && selectedIds && onSelectionChange;

  const allVisibleSelected = isSelectable && sortedData.length > 0 && sortedData.every(r => selectedIds!.has(r._id));
  const someVisibleSelected = isSelectable && sortedData.some(r => selectedIds!.has(r._id));

  function handleSelectAll() {
    if (!isSelectable) return;
    const next = new Set(selectedIds!);
    if (allVisibleSelected) {
      // Deselect all visible
      for (const r of sortedData) next.delete(r._id);
    } else {
      // Select all visible
      for (const r of sortedData) next.add(r._id);
    }
    onSelectionChange!(next);
  }

  function handleSelectRow(id: string) {
    if (!isSelectable) return;
    const next = new Set(selectedIds!);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange!(next);
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2">
        <FiberLoadingAnimation />
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col px-4 py-2">
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          {emptyIcon}
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 py-2">
      <div className="rounded-md border flex-1 min-h-0 overflow-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {isSelectable && (
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.label}
                  className="whitespace-nowrap text-xs text-left cursor-pointer select-none hover:text-foreground"
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow
                key={row._id}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onRowClick?.(row)}
              >
                {isSelectable && (
                  <TableCell className="text-center w-[40px]">
                    <Checkbox
                      checked={selectedIds!.has(row._id)}
                      onCheckedChange={() => handleSelectRow(row._id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select row ${row._id}`}
                    />
                  </TableCell>
                )}
                {columns.map((col) => {
                  const custom = renderCell?.(row, col);
                  return (
                    <TableCell
                      key={col.label}
                      className="text-xs"
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      {custom !== undefined
                        ? custom
                        : defaultRenderCell(
                            (row as Record<string, unknown>)[col.key],
                            col
                          )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {footerRow && sortedData.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold sticky bottom-0 border-t-2">
                {isSelectable && <TableCell />}
                {columns.map((col) => (
                  <TableCell key={col.label} className="text-xs">
                    {footerRow[col.key] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
        {loadingMore && (
          <div className="py-3 text-center text-xs text-muted-foreground">
            Loading more...
          </div>
        )}
      </div>
      <div className="shrink-0 py-2 text-xs text-muted-foreground text-right">
        {sortedData.length.toLocaleString()} / {totalCount.toLocaleString()} records
      </div>
    </div>
  );
}
