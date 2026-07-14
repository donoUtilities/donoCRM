"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconReceipt,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface SplicingInvoice {
  _id: string;
  legacy_id: string;
  invoiceNumber: string;
  date: string;
  bspdORDtap: string;
  spliceItems: string[];
  spliceItemsCount: number;
  team: string;
  isPaid: boolean;
  createdOn: string;
}

const columns: ColumnDef<SplicingInvoice>[] = [
  { label: "Invoice #", key: "invoiceNumber" },
  { label: "Date", key: "date", type: "date" },
  { label: "BSPD or DTAP", key: "bspdORDtap" },
  { label: "Splicing Items", key: "spliceItemsCount", type: "number" },
  { label: "Team", key: "team" },
  { label: "Payment Status", key: "isPaid" },
  { label: "Created On", key: "createdOn", type: "date" },
];

export function SplicingInvoicesContent() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = React.useState(false);
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, reset } =
    useInfiniteData<SplicingInvoice>({ apiUrl: "/api/splicing-invoices" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { team: "all", bspdORDtap: "all", payment: "all" },
    });

  const fo = filterOptions;
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/splicing-invoices/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync Splicing invoices");
      }
      toast.success(data.message || "Splicing invoices synced successfully");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.team !== "all" && r.team !== filters.team) return false;
      if (filters.bspdORDtap !== "all" && r.bspdORDtap !== filters.bspdORDtap) return false;
      if (filters.payment !== "all") {
        const paid = filters.payment === "Paid";
        if (r.isPaid !== paid) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Splicing Invoices"
        description="All Splicing invoices"
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
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[140px]" />
            <FilterSelect value={filters.bspdORDtap} onValueChange={(v) => setFilter("bspdORDtap", v)} placeholder="Type" allLabel="All Types" options={fo.bspdORDtaps || []} className="w-[130px]" />
            <FilterSelect value={filters.payment} onValueChange={(v) => setFilter("payment", v)} placeholder="Payment" allLabel="All Payments" options={["Paid", "Unpaid"]} className="w-[130px]" />
          </>
        }
        actions={
          (session?.user?.id === "6a131382e3fa8f250493dbe7" || session?.user?.email === "adeel@donoutilities.com") && (
            <Button
              onClick={handleSync}
              size="icon"
              className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white shrink-0"
              disabled={syncing}
              title="Sync from AppSheet"
            >
              <IconRefresh className={cn("size-4", syncing && "animate-spin")} />
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={filteredRecords}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        totalCount={totalCount}
        onLoadMore={loadMore}
        emptyIcon={<IconReceipt className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching invoices" : "No splicing invoices found"}
        renderCell={(row, col) => {
          if (col.key === "isPaid") {
            return (
              <Badge variant={row.isPaid ? "default" : "destructive"}>
                {row.isPaid ? "Paid" : "Unpaid"}
              </Badge>
            );
          }
          if (col.key === "spliceItemsCount") {
            const items = row.spliceItems || [];
            const isExpanded = expandedRows.has(row._id);
            return (
              <div className="flex items-start gap-1.5">
                <span className={`text-xs text-muted-foreground ${isExpanded ? "whitespace-normal" : "truncate max-w-[200px]"}`}>
                  {items.length ? items.join(", ") : "—"}
                </span>
                {items.length > 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 cursor-pointer hover:bg-muted"
                    onClick={(e) => { e.stopPropagation(); toggleExpand(row._id); }}
                  >
                    {row.spliceItemsCount}
                  </Badge>
                )}
              </div>
            );
          }
          return undefined;
        }}
      />
    </div>
  );
}
