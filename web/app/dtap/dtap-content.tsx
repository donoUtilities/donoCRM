"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { IconSearch, IconFileSpreadsheet, IconX, IconPlus, IconUpload, IconDownload } from "@tabler/icons-react";

import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface DtapRecord {
  _id: string;
  dtap: string;
  wireCenterId: string;
  wireCenterName: string;
  teamId: string;
  teamName: string;
  completionStatus: string;
  testingStatus: string;
  requestedTimeStamp: string;
  invoiceStatus: string;
}

const columns: ColumnDef<DtapRecord>[] = [
  { label: "DTAP", key: "dtap" },
  { label: "Wire Center", key: "wireCenterName" },
  { label: "Team", key: "teamName" },
  { label: "Completion", key: "completionStatus", type: "badge" },
  { label: "Testing", key: "testingStatus", type: "badge" },
  { label: "Requested", key: "requestedTimeStamp", type: "date" },
  { label: "Invoice Status", key: "invoiceStatus", type: "badge" },
];

export function DtapContent() {
  const router = useRouter();
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions } =
    useInfiniteData<DtapRecord>({ apiUrl: "/api/dtap" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { wireCenter: "all", team: "all", completion: "all", testing: "all", invoice: "all" },
    });

  // Filter options from full database (via API distinct queries)
  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.wireCenter !== "all" && r.wireCenterName !== filters.wireCenter) return false;
      if (filters.team !== "all" && r.teamName !== filters.team) return false;
      if (filters.completion !== "all" && r.completionStatus !== filters.completion) return false;
      if (filters.testing !== "all" && r.testingStatus !== filters.testing) return false;
      if (filters.invoice !== "all" && r.invoiceStatus !== filters.invoice) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.dtap.toLowerCase().includes(q) ||
          r.wireCenterName.toLowerCase().includes(q) ||
          r.teamName.toLowerCase().includes(q) ||
          r.completionStatus.toLowerCase().includes(q) ||
          r.testingStatus.toLowerCase().includes(q) ||
          r.invoiceStatus.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="DTAP"
        description="Design, Test, Accept, and Provision records"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search DTAP records..."
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
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[130px]" />
            <FilterSelect value={filters.completion} onValueChange={(v) => setFilter("completion", v)} placeholder="Completion" allLabel="All Completion" options={fo.completionStatuses || []} className="w-[140px]" />
            <FilterSelect value={filters.testing} onValueChange={(v) => setFilter("testing", v)} placeholder="Testing" allLabel="All Testing" options={fo.testingStatuses || []} className="w-[130px]" />
            <FilterSelect value={filters.invoice} onValueChange={(v) => setFilter("invoice", v)} placeholder="Invoice Status" allLabel="All Invoices" options={fo.invoiceStatuses || []} className="w-[150px]" />

          </>
        }
        actions={
          <>
            <Button size="sm">
              <IconPlus className="mr-1 size-4" />
              Add
            </Button>
            <Button variant="outline" size="icon" className="size-8" title="Import">
              <IconUpload className="size-4 text-green-500" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" title="Export">
              <IconDownload className="size-4 text-red-500" />
            </Button>
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
        emptyMessage={searchQuery || hasActiveFilters ? "No matching DTAP records" : "No DTAP records found"}
        onRowClick={(r) => router.push(`/dtap/${r._id}`)}
      />
    </div>
  );
}
