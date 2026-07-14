"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconFileSpreadsheet,
  IconX,
  IconPlus,
  IconUpload,
  IconDownload,
  IconRefresh,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface BspdItem {
  _id: string;
  feeder: string;
  wireCenter: string;
  cableType: string;
  totalFT: number | null;
  team: string;
  BSPDCompleteInFull: boolean | null;
  completionDate: string;
  invoiceStatus: string;
  requestedTimeStamp: string;
}

const columns: ColumnDef<BspdItem>[] = [
  { label: "Feeder", key: "feeder" },
  { label: "Wire Center", key: "wireCenter" },
  { label: "Cable Type", key: "cableType" },
  { label: "Total [ft]", key: "totalFT", type: "number" },
  { label: "Team", key: "team" },
  { label: "BSPD Complete in Full", key: "BSPDCompleteInFull", type: "bool" },
  { label: "Completion Date", key: "completionDate", type: "date" },
  { label: "Invoice Status", key: "invoiceStatus", type: "badge" },
  { label: "Requested TimeStamp", key: "requestedTimeStamp", type: "date" },
];

export function BspdContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [syncing, setSyncing] = React.useState(false);
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, reset } =
    useInfiniteData<BspdItem>({ apiUrl: "/api/bspd" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { wireCenter: "all", cableType: "all", team: "all", invoiceStatus: "all" },
    });

  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/bspd/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync BSPD items");
      }
      toast.success(data.message || "BSPD items synced successfully");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.wireCenter !== "all" && r.wireCenter !== filters.wireCenter) return false;
      if (filters.cableType !== "all" && r.cableType !== filters.cableType) return false;
      if (filters.team !== "all" && r.team !== filters.team) return false;
      if (filters.invoiceStatus !== "all" && r.invoiceStatus !== filters.invoiceStatus) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.feeder.toLowerCase().includes(q) ||
          r.wireCenter.toLowerCase().includes(q) ||
          r.cableType.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q) ||
          r.invoiceStatus.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="BSPD Items"
        description="Manage BSPD items"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search BSPD..."
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
            <FilterSelect value={filters.wireCenter} onValueChange={(v) => setFilter("wireCenter", v)} placeholder="Wire Center" allLabel="All Wire Centers" options={fo.wireCenters || []} className="w-[150px]" />
            <FilterSelect value={filters.cableType} onValueChange={(v) => setFilter("cableType", v)} placeholder="Cable Type" allLabel="All Cable Types" options={fo.cableTypes || []} className="w-[140px]" />
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[130px]" />
            <FilterSelect value={filters.invoiceStatus} onValueChange={(v) => setFilter("invoiceStatus", v)} placeholder="Invoice Status" allLabel="All Invoice Status" options={fo.invoiceStatuses || []} className="w-[155px]" />

          </>
        }
        actions={
          <>
            <Button size="sm" onClick={() => router.push("/bspd/new")}>
              <IconPlus className="mr-1 size-4" />
              Add
            </Button>
            <Button variant="outline" size="icon" className="size-8" title="Import">
              <IconUpload className="size-4 text-green-500" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" title="Export">
              <IconDownload className="size-4 text-red-500" />
            </Button>
            {(session?.user?.id === "6a131382e3fa8f250493dbe7" || session?.user?.email === "adeel@donoutilities.com") && (
              <Button
                onClick={handleSync}
                size="icon"
                className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white shrink-0"
                disabled={syncing}
                title="Sync from AppSheet"
              >
                <IconRefresh className={cn("size-4", syncing && "animate-spin")} />
              </Button>
            )}
          </>
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
        emptyIcon={<IconFileSpreadsheet className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching items" : "No BSPD items found"}
        onRowClick={(r) => router.push(`/bspd/${r._id}`)}
      />
    </div>
  );
}
