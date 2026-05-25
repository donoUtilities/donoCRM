"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconFileSpreadsheet,
  IconX,
  IconFileTypePdf,
  IconLoader2,
  IconRefresh,
  IconPlayerStop,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface DtapInvoice {
  _id: string;
  invoiceNumber: string;
  week: string;
  dtapName: string;
  dtapItemsIds: string[];
  teamName: string;
  wireCenterName: string;
  isPaid: boolean;
  adminInvoice: string;
  teamInvoice: string;
  adminInvoiceTotal: number;
  teamInvoiceTotal: number;
  createdOn: string;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

const columns: ColumnDef<DtapInvoice>[] = [
  { label: "Invoice #", key: "invoiceNumber" },
  { label: "Week", key: "week" },
  { label: "DTAP", key: "dtapName" },
  { label: "Items", key: "dtapItemsCount" },
  { label: "Team", key: "teamName" },
  { label: "Wire Center", key: "wireCenterName" },
  { label: "Payment Status", key: "isPaid", type: "bool" },
  { label: "Admin Invoice", key: "adminInvoiceTotal", width: "180px" },
  { label: "Team Invoice", key: "teamInvoiceTotal", width: "180px" },
  { label: "Created On", key: "createdOn", type: "date" },
];

/* ── SSE stream consumer ── */

interface BatchEvent {
  invoiceId?: string;
  status?: "ok" | "error" | "started";
  adminInvoice?: string;
  teamInvoice?: string;
  error?: string;
  done?: boolean;
  total?: number;
  succeeded?: number;
  failed?: number;
}

export function DtapInvoicesContent() {
  const router = useRouter();

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { payment: "all", wireCenter: "all", dtap: "all", team: "all", week: "all" },
    });

  // Debounce search to avoid firing a server request on every keystroke
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Pass filters + debounced search to useInfiniteData for server-side filtering
  const serverFilters = React.useMemo(() => ({
    ...filters,
    q: debouncedSearch,
  }), [filters, debouncedSearch]);

  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, updateRecord } =
    useInfiniteData<DtapInvoice>({ apiUrl: "/api/dtap-invoices", filters: serverFilters });

  const fo = filterOptions;

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // ── Batch generation state ──
  const [batchState, setBatchState] = React.useState<{
    running: boolean;
    total: number;
    done: number;
    succeeded: number;
    failed: number;
  }>({ running: false, total: 0, done: 0, succeeded: 0, failed: 0 });
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Track which invoices are currently being generated (for spinner display)
  const [batchGeneratingIds, setBatchGeneratingIds] = React.useState<Set<string>>(new Set());

  async function handleBatchGenerate(ids: string[]) {
    if (ids.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setBatchState({ running: true, total: ids.length, done: 0, succeeded: 0, failed: 0 });
    setBatchGeneratingIds(new Set()); // start empty — filled incrementally as "started" events arrive

    // Clear stale URLs immediately
    for (const id of ids) {
      updateRecord?.(id, { adminInvoice: "", teamInvoice: "" } as Partial<DtapInvoice>);
    }

    try {
      const res = await fetch("/api/dtap-invoices/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response body may not be JSON (e.g. HTML error page or empty)
          try { errorMsg = (await res.text()) || errorMsg; } catch { /* ignore */ }
        }
        console.error("Batch generation failed:", errorMsg);
        setBatchState(prev => ({ ...prev, running: false }));
        setBatchGeneratingIds(new Set());
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: BatchEvent = JSON.parse(line.slice(6));

            if (event.done) {
              setBatchState(prev => ({
                ...prev,
                running: false,
                succeeded: event.succeeded ?? prev.succeeded,
                failed: event.failed ?? prev.failed,
              }));
              setBatchGeneratingIds(new Set());
              setSelectedIds(new Set());
              break;
            }

            // "started" — invoice task picked up by the limiter, show spinner
            if (event.invoiceId && event.status === "started") {
              setBatchGeneratingIds(prev => {
                const next = new Set(prev);
                next.add(event.invoiceId!);
                return next;
              });
            } else if (event.invoiceId && event.status === "ok") {
              updateRecord?.(event.invoiceId, {
                adminInvoice: event.adminInvoice || "",
                teamInvoice: event.teamInvoice || "",
              } as Partial<DtapInvoice>);
              setBatchGeneratingIds(prev => {
                const next = new Set(prev);
                next.delete(event.invoiceId!);
                return next;
              });
              setBatchState(prev => ({
                ...prev,
                done: prev.done + 1,
                succeeded: prev.succeeded + 1,
              }));
            } else if (event.invoiceId && event.status === "error") {
              console.error(`Invoice ${event.invoiceId} failed:`, event.error);
              setBatchGeneratingIds(prev => {
                const next = new Set(prev);
                next.delete(event.invoiceId!);
                return next;
              });
              setBatchState(prev => ({
                ...prev,
                done: prev.done + 1,
                failed: prev.failed + 1,
              }));
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("Batch generation cancelled by user");
      } else {
        console.error("Batch stream error:", err);
      }
      setBatchState(prev => ({ ...prev, running: false }));
      setBatchGeneratingIds(new Set());
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  // Single-row regenerate goes through the same batch path
  function handleRegenerate(invoiceId: string) {
    if (batchGeneratingIds.has(invoiceId) || batchState.running) return;
    handleBatchGenerate([invoiceId]);
  }

  const isGenerating = (id: string) => batchGeneratingIds.has(id);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="DTAP Invoices"
        description="All invoices across DTAP projects"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        }
        filters={
          <>
            {hasActiveFilters && (
              <Button variant="destructive" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                <IconX className="mr-1 size-3" />
                Clear
              </Button>
            )}
            <FilterSelect value={filters.payment} onValueChange={(v) => setFilter("payment", v)} placeholder="Payment Status" allLabel="All Payment Status" options={fo.payments || []} className="w-[155px]" />
            <FilterSelect value={filters.wireCenter} onValueChange={(v) => setFilter("wireCenter", v)} placeholder="Wire Center" allLabel="All Wire Centers" options={fo.wireCenters || []} className="w-[150px]" />
            <FilterSelect value={filters.dtap} onValueChange={(v) => setFilter("dtap", v)} placeholder="DTAP" allLabel="All DTAP" options={fo.dtaps || []} className="w-[130px]" />
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[130px]" />
            <FilterSelect value={filters.week} onValueChange={(v) => setFilter("week", v)} placeholder="Week" allLabel="All Weeks" options={fo.weeks || []} className="w-[120px]" />

          </>
        }
        actions={
          selectedIds.size > 1 ? (
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={batchState.running}
              onClick={() => handleBatchGenerate([...selectedIds])}
            >
              <IconFileTypePdf className="mr-1.5 size-3.5" />
              Generate Selected ({selectedIds.size})
            </Button>
          ) : null
        }
      />

      {/* ── Batch progress strip ── */}
      {batchState.running && batchState.total > 1 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <IconLoader2 className="size-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium text-blue-500">
            Generated {batchState.done}/{batchState.total}
            {batchGeneratingIds.size > 0 && ` (${batchGeneratingIds.size} active)`}...
          </span>
          {batchState.failed > 0 && (
            <span className="text-sm text-red-400">
              ({batchState.failed} failed)
            </span>
          )}
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs px-3"
            onClick={handleCancel}
          >
            <IconPlayerStop className="mr-1 size-3" />
            Cancel
          </Button>
        </div>
      )}

      {/* ── Batch complete summary ── */}
      {!batchState.running && batchState.total > 1 && batchState.done === batchState.total && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-green-500/10 border-b border-green-500/20">
          <span className="text-sm font-medium text-green-500">
            ✓ Generated {batchState.succeeded}/{batchState.total} invoices
          </span>
          {batchState.failed > 0 && (
            <span className="text-sm text-red-400">
              ({batchState.failed} failed)
            </span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setBatchState({ running: false, total: 0, done: 0, succeeded: 0, failed: 0 })}
          >
            Dismiss
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        totalCount={totalCount}
        onLoadMore={loadMore}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={<IconFileSpreadsheet className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching invoices" : "No DTAP invoices found"}
        renderCell={(row, col) => {
          if (col.key === "dtapItemsCount") {
            return <span>{Array.isArray(row.dtapItemsIds) ? row.dtapItemsIds.length : 0}</span>;
          }
          if (col.key === "invoiceNumber") {
            return (
              <button
                className="text-blue-500 hover:text-blue-400 hover:underline font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dtap-records?invoiceId=${row._id}`);
                }}
              >
                {row.invoiceNumber}
              </button>
            );
          }
          if (col.key === "isPaid") {
            return (
              <Badge variant={row.isPaid ? "default" : "destructive"}>
                {row.isPaid ? "Paid" : "Unpaid"}
              </Badge>
            );
          }
          if (col.key === "adminInvoiceTotal") {
            const val = formatCurrency(row.adminInvoiceTotal || 0);
            const generating = isGenerating(row._id);
            return (
              <span className="inline-flex items-center gap-2">
                <span className="font-bold text-green-500">{val}</span>
                {row.adminInvoice && (
                  <a
                    href={row.adminInvoice}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center size-7 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="View PDF"
                  >
                    <IconFileTypePdf className="size-5" />
                  </a>
                )}
                <button
                  className="inline-flex items-center justify-center size-7 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  disabled={generating || batchState.running}
                  onClick={(e) => { e.stopPropagation(); handleRegenerate(row._id); }}
                  title={row.adminInvoice ? "Regenerate Invoice" : "Generate Invoice"}
                >
                  {generating ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
                </button>
              </span>
            );
          }
          if (col.key === "teamInvoiceTotal") {
            const val = formatCurrency(row.teamInvoiceTotal || 0);
            const generating = isGenerating(row._id);
            return (
              <span className="inline-flex items-center gap-2">
                <span className="font-bold text-blue-500">{val}</span>
                {row.teamInvoice && (
                  <a
                    href={row.teamInvoice}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center size-7 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="View PDF"
                  >
                    <IconFileTypePdf className="size-5" />
                  </a>
                )}
                <button
                  className="inline-flex items-center justify-center size-7 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  disabled={generating || batchState.running}
                  onClick={(e) => { e.stopPropagation(); handleRegenerate(row._id); }}
                  title={row.teamInvoice ? "Regenerate Invoice" : "Generate Invoice"}
                >
                  {generating ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
                </button>
              </span>
            );
          }
          return undefined;
        }}
      />
    </div>
  );
}
