"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconDatabase,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface BspdRecord {
  _id: string;
  feeder: string;
  item: string;
  itemDescription: string;
  actualFT: number | null;
  uom: string;
  tickMarkStart: number | null;
  tickMarkStartPicture: string;
  tickMarkEnd: number | null;
  tickMarkEndPicture: string;
  redLines: string;
  workProcesPicture: string;
  additionalPicture: string;
  price: number | null;
  salePrice: number | null;
  completedBy: string;
  completedAt: string;
}

const columns: ColumnDef<BspdRecord>[] = [
  { label: "Feeder", key: "feeder" },
  { label: "Item", key: "item" },
  { label: "Item Description", key: "itemDescription" },
  { label: "Actual ft", key: "actualFT", type: "number" },
  { label: "UOM", key: "uom" },
  { label: "Tick Mark Start", key: "tickMarkStart", type: "number" },
  { label: "Tick Mark Start Picture", key: "tickMarkStartPicture" },
  { label: "Tick Mark End", key: "tickMarkEnd", type: "number" },
  { label: "Tick Mark End Picture", key: "tickMarkEndPicture" },
  { label: "Red Lines", key: "redLines" },
  { label: "Work Proces Picture", key: "workProcesPicture" },
  { label: "Additional Picture", key: "additionalPicture" },
  { label: "Price", key: "price", type: "dollar" },
  { label: "Sale Price", key: "salePrice", type: "dollar" },
  { label: "Completed By", key: "completedBy" },
  { label: "Completed On", key: "completedAt", type: "date" },
];

export function BspdRecordsContent() {
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions } =
    useInfiniteData<BspdRecord>({ apiUrl: "/api/bspd-records" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { feeder: "all", item: "all", uom: "all", completedBy: "all" },
    });
  const [previewImage, setPreviewImage] = React.useState<{ url: string; label: string } | null>(null);

  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.feeder !== "all" && r.feeder !== filters.feeder) return false;
      if (filters.item !== "all" && r.item !== filters.item) return false;
      if (filters.uom !== "all" && r.uom !== filters.uom) return false;
      if (filters.completedBy !== "all" && r.completedBy !== filters.completedBy) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.feeder.toLowerCase().includes(q) ||
          r.item.toLowerCase().includes(q) ||
          r.itemDescription.toLowerCase().includes(q) ||
          r.completedBy.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  const imageKeys: (keyof BspdRecord)[] = [
    "tickMarkStartPicture",
    "tickMarkEndPicture",
    "redLines",
    "workProcesPicture",
    "additionalPicture",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="BSPD Records"
        description="All BSPD item records"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search records..."
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
            <FilterSelect value={filters.feeder} onValueChange={(v) => setFilter("feeder", v)} placeholder="Feeder" allLabel="All Feeders" options={fo.feeders || []} className="w-[140px]" />
            <FilterSelect value={filters.item} onValueChange={(v) => setFilter("item", v)} placeholder="Item" allLabel="All Items" options={fo.items || []} className="w-[130px]" />
            <FilterSelect value={filters.uom} onValueChange={(v) => setFilter("uom", v)} placeholder="UOM" allLabel="All UOM" options={fo.uoms || []} className="w-[120px]" />
            <FilterSelect value={filters.completedBy} onValueChange={(v) => setFilter("completedBy", v)} placeholder="Completed By" allLabel="All Users" options={fo.completedBys || []} className="w-[150px]" />

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
        emptyIcon={<IconDatabase className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching records" : "No BSPD records found"}
        renderCell={(row, col) => {
          // Image thumbnail columns
          if (imageKeys.includes(col.key as keyof BspdRecord)) {
            const url = row[col.key as keyof typeof row] as string;
            if (!url) return "—";
            return (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewImage({ url, label: col.label }); }}
                className="block cursor-pointer"
              >
                <img
                  src={url}
                  alt={col.label}
                  className="h-8 w-8 rounded object-cover border hover:scale-150 hover:z-10 transition-transform"
                />
              </button>
            );
          }
          // UOM as badge
          if (col.key === "uom" && row.uom) {
            return <Badge variant="outline">{row.uom}</Badge>;
          }
          return undefined;
        }}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogTitle className="sr-only">
            {previewImage?.label ?? "Image Preview"}
          </DialogTitle>
          {previewImage && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium">{previewImage.label}</p>
              <img
                src={previewImage.url}
                alt={previewImage.label}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
