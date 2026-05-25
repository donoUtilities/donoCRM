"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconCurrencyDollar,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";

interface BspdPrice {
  _id: string;
  itemNumber: string;
  itemName: string;
  itemDescription: string;
  uom: string;
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
  salePrice: number | null;
  isTickmark: boolean;
  isRedLine: boolean;
  isPicture: boolean;
}

const columns: ColumnDef<BspdPrice>[] = [
  { label: "Item Number", key: "itemNumber" },
  { label: "Item Name", key: "itemName" },
  { label: "Item Description", key: "itemDescription" },
  { label: "UOM", key: "uom" },
  { label: "Tier 1 $", key: "tier1", type: "dollar" },
  { label: "Tier 2 $", key: "tier2", type: "dollar" },
  { label: "Tier 3 $", key: "tier3", type: "dollar" },
  { label: "Sale Price", key: "salePrice", type: "dollar" },
  { label: "Tickmark", key: "isTickmark" },
  { label: "Red Line", key: "isRedLine" },
  { label: "Picture", key: "isPicture" },
];

export function BspdPricesContent() {
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions } =
    useInfiniteData<BspdPrice>({ apiUrl: "/api/bspd-prices" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { uom: "all" },
    });

  const fo = filterOptions;

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.uom !== "all" && r.uom !== filters.uom) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.itemNumber.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.itemDescription.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, searchQuery, filters]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="BSPD Prices"
        description="Manage BSPD pricing items"
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
        emptyMessage={searchQuery || hasActiveFilters ? "No matching prices" : "No BSPD prices found"}
        renderCell={(row, col) => {
          if (col.key === "isTickmark" || col.key === "isRedLine" || col.key === "isPicture") {
            const val = row[col.key as keyof BspdPrice] as boolean;
            return (
              <Badge variant={val ? "default" : "secondary"}>
                {val ? "Yes" : "No"}
              </Badge>
            );
          }
          return undefined;
        }}
      />
    </div>
  );
}
