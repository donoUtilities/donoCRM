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
  IconClock,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";

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

export function DtapInvoicesContent() {
  const router = useRouter();

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { payment: "all", wireCenter: "all", dtap: "all", team: "all", week: "all" },
    });

  // Pass filters + search to useInfiniteData for server-side filtering
  const serverFilters = React.useMemo(() => ({
    ...filters,
    q: searchQuery,
  }), [filters, searchQuery]);

  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, updateRecord } =
    useInfiniteData<DtapInvoice>({ apiUrl: "/api/dtap-invoices", filters: serverFilters });

  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = React.useState<string[]>([]);

  const fo = filterOptions;

  // Process one invoice at a time
  React.useEffect(() => {
    if (generatingId || pendingQueue.length === 0) return;

    const [nextId, ...rest] = pendingQueue;
    setPendingQueue(rest);
    setGeneratingId(nextId);

    // Clear stale URLs immediately
    updateRecord?.(nextId, { adminInvoice: "", teamInvoice: "" });

    (async () => {
      try {
        const res = await fetch("/api/dtap-invoices/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: nextId }),
        });
        const data = await res.json();
        if (res.ok) {
          updateRecord?.(nextId, {
            adminInvoice: data.adminInvoice,
            teamInvoice: data.teamInvoice,
          });
        } else {
          console.error("Generation failed:", data.error);
        }
      } catch (err) {
        console.error("Generation error:", err);
      } finally {
        setGeneratingId(null); // triggers useEffect to process next
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatingId, pendingQueue]);

  function handleGenerate(invoiceId: string) {
    if (generatingId === invoiceId || pendingQueue.includes(invoiceId)) return;
    setPendingQueue((prev) => [...prev, invoiceId]);
  }

  // Helper to check if an invoice is busy (generating or queued)
  const isGenerating = (id: string) => generatingId === id;
  const isQueued = (id: string) => pendingQueue.includes(id);

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
      />

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        totalCount={totalCount}
        onLoadMore={loadMore}
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
            const queued = isQueued(row._id);
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
                  disabled={generating || queued}
                  onClick={(e) => { e.stopPropagation(); handleGenerate(row._id); }}
                  title={queued ? "Queued" : row.adminInvoice ? "Regenerate Invoice" : "Generate Invoice"}
                >
                  {generating ? <IconLoader2 className="size-4 animate-spin" /> : queued ? <IconClock className="size-4 text-orange-400" /> : <IconRefresh className="size-4" />}
                </button>
              </span>
            );
          }
          if (col.key === "teamInvoiceTotal") {
            const val = formatCurrency(row.teamInvoiceTotal || 0);
            const generating = isGenerating(row._id);
            const queued = isQueued(row._id);
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
                  disabled={generating || queued}
                  onClick={(e) => { e.stopPropagation(); handleGenerate(row._id); }}
                  title={queued ? "Queued" : row.teamInvoice ? "Regenerate Invoice" : "Generate Invoice"}
                >
                  {generating ? <IconLoader2 className="size-4 animate-spin" /> : queued ? <IconClock className="size-4 text-orange-400" /> : <IconRefresh className="size-4" />}
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
