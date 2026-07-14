"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconDatabase,
  IconX,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface SplicingRecord {
  _id: string;
  legacy_id: string;
  team: string;
  bspdORdtap: string;
  wireCenter: string;
  cableType: string;
  feeder: string;
  feederSpliceTo: string[];
  dtap: string;
  spliceSetupTeardownAerial: string | null;
  teardownAerialPicture: string;
  fiberFusionFibererial: string | null;
  fiberFusionFibererialNumber: number | null;
  singleSplicePictures: string[];
  spliceTestFiberFusionRibbon: string | null;
  spliceTestFiberFusionRibbonNumber: number | null;
  ribbonSplicePictures: string[];
  spliceTestFiberFusionPartialRibbon: string | null;
  spliceTestFiberFusionPartialRibbonNumber: number | null;
  partialRibbonSplicePictures: string[];
  casePlacement: string;
  casePlacementPicture: string;
  spliceDTAP: boolean;
  spliceDTAPPicture: string;
  placeDTAPAerial: string;
  placeDTAPAerialPicture: string;
  testDTAPPwrMtrOtdr: string;
  portPictures: string[];
  completedBy: string;
  completedOn: string;
  invoiceRequested: string;
  requestedOn: string;
}

const columns: ColumnDef<SplicingRecord>[] = [
  { label: "RecordId", key: "legacy_id" },
  { label: "Team", key: "team" },
  { label: "BSPD or DTAP", key: "bspdORdtap" },
  { label: "Wire Center", key: "wireCenter" },
  { label: "Cable Type", key: "cableType" },
  { label: "Feeder BSPD #", key: "feeder" },
  { label: "Feeder BSPD Splice to", key: "feederSpliceTo" },
  { label: "DTAP", key: "dtap" },
  { label: "Splice Setup", key: "spliceSetupTeardownAerial", type: "bool" },
  { label: "Teardown Aerial Pic", key: "teardownAerialPicture" },
  { label: "Fiber Fusion", key: "fiberFusionFibererial", type: "bool" },
  { label: "Fiber Fusion #", key: "fiberFusionFibererialNumber", type: "number" },
  { label: "Single Splice Pics", key: "singleSplicePictures" },
  { label: "Ribbon Splice", key: "spliceTestFiberFusionRibbon", type: "bool" },
  { label: "Ribbon Splice #", key: "spliceTestFiberFusionRibbonNumber", type: "number" },
  { label: "Ribbon Splice Pics", key: "ribbonSplicePictures" },
  { label: "Partial Ribbon Splice", key: "spliceTestFiberFusionPartialRibbon", type: "bool" },
  { label: "Partial Ribbon #", key: "spliceTestFiberFusionPartialRibbonNumber", type: "number" },
  { label: "Partial Ribbon Pics", key: "partialRibbonSplicePictures" },
  { label: "Case Placement", key: "casePlacement", type: "bool" },
  { label: "Case Placement Pic", key: "casePlacementPicture" },
  { label: "Splice DTAP", key: "spliceDTAP", type: "bool" },
  { label: "Splice DTAP Pic", key: "spliceDTAPPicture" },
  { label: "Place DTAP Aerial", key: "placeDTAPAerial", type: "bool" },
  { label: "Place DTAP Pic", key: "placeDTAPAerialPicture" },
  { label: "Test DTAP PWR-MTR", key: "testDTAPPwrMtrOtdr", type: "bool" },
  { label: "Port Pics", key: "portPictures" },
  { label: "Completed By", key: "completedBy" },
  { label: "Completed On", key: "completedOn", type: "date" },
  { label: "Invoice Requested", key: "invoiceRequested", type: "bool" },
  { label: "Requested On", key: "requestedOn", type: "date" },
];

export function SplicingRecordsContent() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = React.useState(false);
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, reset } =
    useInfiniteData<SplicingRecord>({ apiUrl: "/api/splicing-records" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { team: "all", wireCenter: "all", bspdORdtap: "all" },
    });
  const [previewGallery, setPreviewGallery] = React.useState<{ urls: string[]; label: string; initialIndex: number } | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = React.useState(0);

  React.useEffect(() => {
    if (previewGallery) {
      setActiveGalleryIndex(previewGallery.initialIndex);
    }
  }, [previewGallery]);

  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/splicing-records/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync Splicing records");
      }
      toast.success(data.message || "Splicing records synced successfully");
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
      if (filters.wireCenter !== "all" && r.wireCenter !== filters.wireCenter) return false;
      if (filters.bspdORdtap !== "all" && r.bspdORdtap !== filters.bspdORdtap) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.legacy_id.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q) ||
          r.feeder.toLowerCase().includes(q) ||
          r.dtap.toLowerCase().includes(q) ||
          r.completedBy.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  const imageKeys: (keyof SplicingRecord)[] = [
    "teardownAerialPicture",
    "casePlacementPicture",
    "spliceDTAPPicture",
    "placeDTAPAerialPicture",
  ];

  const imageArrayKeys: (keyof SplicingRecord)[] = [
    "singleSplicePictures",
    "ribbonSplicePictures",
    "partialRibbonSplicePictures",
    "portPictures",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Splicing Records"
        description="All splicing work records"
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
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[140px]" />
            <FilterSelect value={filters.wireCenter} onValueChange={(v) => setFilter("wireCenter", v)} placeholder="Wire Center" allLabel="All Wire Centers" options={fo.wireCenters || []} className="w-[160px]" />
            <FilterSelect value={filters.bspdORdtap} onValueChange={(v) => setFilter("bspdORdtap", v)} placeholder="Type" allLabel="All Types" options={fo.bspdORdtaps || []} className="w-[130px]" />
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
        emptyIcon={<IconDatabase className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching records" : "No splicing records found"}
        renderCell={(row, col) => {
          // Feeder Splice To Array
          if (col.key === "feederSpliceTo") {
            const arr = row.feederSpliceTo || [];
            return arr.length ? arr.join(", ") : "—";
          }

          // Single Image Preview
          if (imageKeys.includes(col.key as keyof SplicingRecord)) {
            const url = row[col.key as keyof typeof row] as string;
            if (!url) return "—";
            const isPdf = url.toLowerCase().includes(".pdf");
            if (isPdf) {
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); window.open(url, "_blank"); }}
                  className="inline-flex items-center justify-center h-7 px-2.5 rounded bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  title="Open PDF in new tab"
                >
                  PDF
                </button>
              );
            }
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewGallery({ urls: [url], label: col.label, initialIndex: 0 });
                }}
                className="block cursor-pointer border rounded overflow-hidden"
              >
                <img
                  src={url}
                  alt={col.label}
                  className="h-8 w-8 rounded object-cover border hover:scale-150 hover:z-10 transition-transform"
                />
              </button>
            );
          }

          // Array of Images Preview
          if (imageArrayKeys.includes(col.key as keyof SplicingRecord)) {
            const urls = row[col.key as keyof typeof row] as string[];
            if (!urls || !urls.length) return "—";

            const displayUrls = urls.slice(0, 3);
            const remainingCount = urls.length - 3;

            return (
              <div className="flex items-center gap-1 py-1">
                {displayUrls.map((url, index) => {
                  const isPdf = url.toLowerCase().includes(".pdf");
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewGallery({ urls, label: col.label, initialIndex: index });
                      }}
                      className="block cursor-pointer shrink-0 border rounded overflow-hidden"
                    >
                      {isPdf ? (
                        <div className="h-8 w-8 flex items-center justify-center bg-red-100 text-red-700 text-[10px] font-bold">
                          PDF
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt={`${col.label} ${index + 1}`}
                          className="h-8 w-8 object-cover hover:scale-110 transition-transform"
                        />
                      )}
                    </button>
                  );
                })}
                {remainingCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewGallery({ urls, label: col.label, initialIndex: 3 });
                    }}
                    className="flex items-center justify-center h-8 w-8 rounded border bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    +{remainingCount}
                  </button>
                )}
              </div>
            );
          }

          return undefined;
        }}
      />

      {/* Gallery / Carousel Preview Dialog */}
      <Dialog open={!!previewGallery} onOpenChange={() => setPreviewGallery(null)}>
        <DialogContent className="max-w-3xl p-4 flex flex-col items-center gap-4">
          <DialogTitle className="sr-only">
            {previewGallery?.label ?? "Preview Gallery"}
          </DialogTitle>
          
          {previewGallery && previewGallery.urls.length > 0 && (
            <div className="w-full flex flex-col items-center gap-4 relative">
              {/* Header Info */}
              <div className="flex items-center justify-between w-full border-b pb-2">
                <span className="text-sm font-medium">{previewGallery.label}</span>
                <span className="text-xs text-muted-foreground">
                  {activeGalleryIndex + 1} of {previewGallery.urls.length}
                </span>
              </div>

              {/* Main Content Area */}
              <div className="w-full flex items-center justify-center min-h-[50vh] max-h-[70vh] bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden relative group">
                {/* Image or PDF Slide */}
                {(() => {
                  const url = previewGallery.urls[activeGalleryIndex];
                  const isPdf = url.toLowerCase().includes(".pdf");

                  if (isPdf) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-4 p-8">
                        <p className="text-muted-foreground text-sm font-medium">This document is a PDF.</p>
                        <Button onClick={() => window.open(url, "_blank")} size="sm" className="bg-red-600 hover:bg-red-700">
                          Open PDF in New Tab
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <img
                      src={url}
                      alt={`${previewGallery.label} Preview`}
                      className="max-h-[65vh] w-full object-contain"
                    />
                  );
                })()}

                {/* Left/Right Navigation buttons (only if > 1 item) */}
                {previewGallery.urls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveGalleryIndex(prev => (prev - 1 + previewGallery.urls.length) % previewGallery.urls.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <IconChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveGalleryIndex(prev => (prev + 1) % previewGallery.urls.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <IconChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail strip for quick navigation */}
              {previewGallery.urls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto max-w-full py-1">
                  {previewGallery.urls.map((url, idx) => {
                    const isPdf = url.toLowerCase().includes(".pdf");
                    const isActive = idx === activeGalleryIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveGalleryIndex(idx)}
                        className={cn(
                          "size-12 rounded border shrink-0 overflow-hidden cursor-pointer transition-all",
                          isActive ? "ring-2 ring-primary border-transparent scale-105" : "opacity-60 hover:opacity-100"
                        )}
                      >
                        {isPdf ? (
                          <div className="h-full w-full flex items-center justify-center bg-red-100 text-red-700 text-[10px] font-bold">
                            PDF
                          </div>
                        ) : (
                          <img src={url} alt="thumbnail" className="h-full w-full object-cover" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
