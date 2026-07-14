"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconCurrencyDollar,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface TreeTrimPrice {
  _id: string;
  itemNumber: string;
  itemDescription: string;
  uom: string;
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
  salePrice: number | null;
}

const columns: ColumnDef<TreeTrimPrice>[] = [
  { label: "Item Number", key: "itemNumber" },
  { label: "Item Description", key: "itemDescription" },
  { label: "UOM", key: "uom" },
  { label: "Tier 1 $", key: "tier1", type: "dollar" },
  { label: "Tier 2 $", key: "tier2", type: "dollar" },
  { label: "Tier 3 $", key: "tier3", type: "dollar" },
  { label: "Sale Price", key: "salePrice", type: "dollar" },
];

export function TreeTrimPricesContent() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = React.useState(false);
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, reset } =
    useInfiniteData<TreeTrimPrice>({ apiUrl: "/api/treetrim-prices" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { uom: "all" },
    });

  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/treetrim-prices/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync Tree Trim prices");
      }
      toast.success(data.message || "Tree Trim prices synced successfully");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.uom !== "all" && r.uom !== filters.uom) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.itemNumber.toLowerCase().includes(q) ||
          r.itemDescription.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Tree Trim Prices"
        description="Manage tree trimming pricing items"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search prices..."
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
            <FilterSelect value={filters.uom} onValueChange={(v) => setFilter("uom", v)} placeholder="UOM" allLabel="All UOMs" options={fo.uoms || []} className="w-[130px]" />
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
        emptyIcon={<IconCurrencyDollar className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching prices" : "No tree trim prices found"}
      />
    </div>
  );
}
