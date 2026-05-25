"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconReceipt,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";

interface BspdInvoice {
  _id: string;
  invoiceNumber: string;
  date: string;
  week: string;
  feederName: string;
  wireCenter: string;
  team: string;
  bspdItems: string[];
  bspdItemsCount: number;
  isPaid: boolean;
  createdOn: string;
}

const columns: ColumnDef<BspdInvoice>[] = [
  { label: "Invoice #", key: "invoiceNumber" },
  { label: "Date", key: "date", type: "date" },
  { label: "Week", key: "week" },
  { label: "Feeder", key: "feederName" },
  { label: "Wire Center", key: "wireCenter" },
  { label: "Team", key: "team" },
  { label: "BSPD Items", key: "bspdItemsCount", type: "number" },
  { label: "Payment Status", key: "isPaid" },
  { label: "Created On", key: "createdOn", type: "date" },
];

export function BspdInvoicesContent() {
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions } =
    useInfiniteData<BspdInvoice>({ apiUrl: "/api/bspd-invoices" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { feeder: "all", wireCenter: "all", team: "all", week: "all", payment: "all" },
    });

  const fo = filterOptions;

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.feeder !== "all" && r.feederName !== filters.feeder) return false;
      if (filters.wireCenter !== "all" && r.wireCenter !== filters.wireCenter) return false;
      if (filters.team !== "all" && r.team !== filters.team) return false;
      if (filters.week !== "all" && r.week !== filters.week) return false;
      if (filters.payment !== "all") {
        const paid = filters.payment === "Paid";
        if (r.isPaid !== paid) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.feederName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, searchQuery, filters]);

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="BSPD Invoices"
        description="All BSPD invoices"
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
            <FilterSelect value={filters.feeder} onValueChange={(v) => setFilter("feeder", v)} placeholder="Feeder" allLabel="All Feeders" options={fo.feeders || []} className="w-[150px]" />
            <FilterSelect value={filters.wireCenter} onValueChange={(v) => setFilter("wireCenter", v)} placeholder="Wire Center" allLabel="All Wire Centers" options={fo.wireCenters || []} className="w-[160px]" />
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[140px]" />
            <FilterSelect value={filters.week} onValueChange={(v) => setFilter("week", v)} placeholder="Week" allLabel="All Weeks" options={fo.weeks || []} className="w-[130px]" />
            <FilterSelect value={filters.payment} onValueChange={(v) => setFilter("payment", v)} placeholder="Payment" allLabel="All Payments" options={fo.payments || []} className="w-[130px]" />

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
        emptyIcon={<IconReceipt className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching invoices" : "No BSPD invoices found"}
        renderCell={(row, col) => {
          if (col.key === "isPaid") {
            return (
              <Badge variant={row.isPaid ? "default" : "destructive"}>
                {row.isPaid ? "Paid" : "Unpaid"}
              </Badge>
            );
          }
          if (col.key === "bspdItemsCount") {
            const items = row.bspdItems || [];
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
                    {row.bspdItemsCount}
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
