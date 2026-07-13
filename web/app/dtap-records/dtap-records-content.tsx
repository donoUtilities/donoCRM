"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconSearch,
  IconFileSpreadsheet,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DtapRecord {
  _id: string;
  dtapName: string;
  wireCenterName: string;
  teamName: string;
  terminalRun: number | null;
  jumperFootage: number | null;
  aerialPrimary: number | null;
  aerialAdditional: number | null;
  undergroundPrimary: number | null;
  undergroundAdditional: number | null;
  terminalName: string;
  termPortAndPower: string;
  termPlacement: string;
  build: string;
  servedHouseholds: number | null;
  aerialPrimaryPercent: string;
  aerialAdditionalPercent: string;
  ugPrimaryPercent: string;
  ugAdditionalPercent: string;
  aerialPrimaryValue: number | null;
  aerialAdditionalValue: number | null;
  ugPrimaryValue: number | null;
  ugAdditionalValue: number | null;
  aerialPrimarySaleValue: number | null;
  aerialAdditionalSaleValue: number | null;
  ugPrimarySaleValue: number | null;
  ugAdditionalSaleValue: number | null;
  placedPrice: number | null;
  placedSalePrice: number | null;
  testedPrice: number | null;
  testedSalePrice: number | null;
  totalValue: number | null;
  saleValue: number | null;
  terminalPlaced: boolean | null;
  terminalPlacedDate: string;
  terminalPlacedPicture: string;
  terminalTested: boolean | null;
  lightLevel: number | null;
  terminalTestedPicture: string;
  terminalTestedDate: string;
  comments: string;
  aerialPrimaryPriceTeam: number | null;
  aerialPrimaryPriceAdmin: number | null;
  aerialAdditionalPriceTeam: number | null;
  aerialAdditionalPriceAdmin: number | null;
  ugPrimaryPriceTeam: number | null;
  ugPrimaryPriceAdmin: number | null;
  ugAdditionalPriceTeam: number | null;
  ugAdditionalPriceAdmin: number | null;
  taskStatus: string;
  isInvoice: boolean | null;
  invoiceInfo: {
    invoiceNumber: string;
    date: string;
    isPaid: boolean;
    week: string;
  } | null;
}

function formatDate(ts: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ts; }
}

/* ── Columns ── */
const columns: ColumnDef<DtapRecord>[] = [
  { label: "DTAP", key: "dtapName" },
  { label: "Wire Center", key: "wireCenterName" },
  { label: "Team", key: "teamName" },
  { label: "Terminal Run", key: "terminalRun", type: "number" },
  { label: "Jumper Footage", key: "jumperFootage", type: "number" },
  { label: "Aerial Primary", key: "aerialPrimary", type: "number" },
  { label: "Aerial Additional", key: "aerialAdditional", type: "number" },
  { label: "Underground Primary", key: "undergroundPrimary", type: "number" },
  { label: "Underground Additional", key: "undergroundAdditional", type: "number" },
  { label: "Terminal Name", key: "terminalName" },
  { label: "Term Port & Power", key: "termPortAndPower" },
  { label: "Term Placement", key: "termPlacement" },
  { label: "Build", key: "build" },
  { label: "Served Households", key: "servedHouseholds", type: "number" },
  { label: "Aerial Primary %", key: "aerialPrimaryPercent" },
  { label: "Aerial Additional %", key: "aerialAdditionalPercent" },
  { label: "UG Primary %", key: "ugPrimaryPercent" },
  { label: "UG Additional %", key: "ugAdditionalPercent" },
  { label: "Aerial Primary Value", key: "aerialPrimaryValue", type: "dollar" },
  { label: "Aerial Additional Value", key: "aerialAdditionalValue", type: "dollar" },
  { label: "UG Primary Value", key: "ugPrimaryValue", type: "dollar" },
  { label: "UG Additional Value", key: "ugAdditionalValue", type: "dollar" },
  { label: "Aerial Primary Sale Value", key: "aerialPrimarySaleValue", type: "dollar" },
  { label: "Aerial Additional Sale Value", key: "aerialAdditionalSaleValue", type: "dollar" },
  { label: "UG Primary Sale Value", key: "ugPrimarySaleValue", type: "dollar" },
  { label: "UG Additional Sale Value", key: "ugAdditionalSaleValue", type: "dollar" },
  { label: "Placed Price", key: "placedPrice", type: "dollar" },
  { label: "Placed Sale Price", key: "placedSalePrice", type: "dollar" },
  { label: "Tested Price", key: "testedPrice", type: "dollar" },
  { label: "Tested Sale Price", key: "testedSalePrice", type: "dollar" },
  { label: "Total Value", key: "totalValue", type: "dollar" },
  { label: "Sale Value", key: "saleValue", type: "dollar" },
  { label: "Terminal Placed", key: "terminalPlaced", type: "bool" },
  { label: "Terminal Placed Date", key: "terminalPlacedDate", type: "date" },
  { label: "Terminal Placed Picture", key: "terminalPlacedPicture" },
  { label: "Terminal Tested", key: "terminalTested", type: "bool" },
  { label: "Light Level", key: "lightLevel", type: "number" },
  { label: "Terminal Tested Picture", key: "terminalTestedPicture" },
  { label: "Terminal Tested Date", key: "terminalTestedDate", type: "date" },
  { label: "Comments", key: "comments" },
  { label: "Aerial Primary Price Team", key: "aerialPrimaryPriceTeam", type: "dollar" },
  { label: "Aerial Primary Price Admin", key: "aerialPrimaryPriceAdmin", type: "dollar" },
  { label: "Aerial Additional Price Team", key: "aerialAdditionalPriceTeam", type: "dollar" },
  { label: "Aerial Additional Price Admin", key: "aerialAdditionalPriceAdmin", type: "dollar" },
  { label: "UG Primary Price Team", key: "ugPrimaryPriceTeam", type: "dollar" },
  { label: "UG Primary Price Admin", key: "ugPrimaryPriceAdmin", type: "dollar" },
  { label: "UG Additional Price Team", key: "ugAdditionalPriceTeam", type: "dollar" },
  { label: "UG Additional Price Admin", key: "ugAdditionalPriceAdmin", type: "dollar" },
  { label: "Task Status", key: "taskStatus", type: "badge" },
  { label: "Invoice Status", key: "isInvoice", type: "bool" },
  { label: "Payment Status", key: "isInvoice" },
];

/* ── Totals row helper ── */
function computeTotals(data: DtapRecord[], cols: ColumnDef<DtapRecord>[]): Record<string, React.ReactNode> {
  const dollarKeys = cols.filter((c) => c.type === "dollar").map((c) => c.key);
  const numberKeys = cols.filter((c) => c.type === "number").map((c) => c.key);
  const sums: Record<string, number> = {};

  for (const key of [...dollarKeys, ...numberKeys]) {
    sums[key] = 0;
  }

  for (const row of data) {
    for (const key of [...dollarKeys, ...numberKeys]) {
      const val = Number((row as unknown as Record<string, unknown>)[key]);
      if (!isNaN(val)) sums[key] += val;
    }
  }

  const result: Record<string, React.ReactNode> = {
    dtapName: <span className="font-bold">TOTAL</span>,
  };

  for (const key of dollarKeys) {
    result[key] = (
      <span className="whitespace-nowrap tabular-nums font-bold">
        {sums[key].toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </span>
    );
  }
  for (const key of numberKeys) {
    result[key] = <span className="tabular-nums font-bold">{sums[key].toLocaleString()}</span>;
  }

  return result;
}

/* ── Component ── */
export function DtapRecordsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get("invoiceId");

  const { data: session } = useSession();
  const [syncing, setSyncing] = React.useState(false);
  const apiUrl = invoiceId ? `/api/dtap-records?invoiceId=${invoiceId}` : "/api/dtap-records";
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, filterOptions, reset } =
    useInfiniteData<DtapRecord>({ apiUrl });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { dtap: "all", wireCenter: "all", team: "all", taskStatus: "all", invoiceStatus: "all", paymentStatus: "all" },
      preserveKeys: ["invoiceId"],
    });
  const [previewImage, setPreviewImage] = React.useState<{ url: string; label: string } | null>(null);
  const [invoicePreview, setInvoicePreview] = React.useState<{
    invoiceNumber: string; date: string; isPaid: boolean; week: string; terminalName: string;
  } | null>(null);

  const fo = filterOptions;

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/dtap-records/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync DTAP records");
      }
      toast.success(data.message || "DTAP records synced successfully");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.dtap !== "all" && r.dtapName !== filters.dtap) return false;
      if (filters.wireCenter !== "all" && r.wireCenterName !== filters.wireCenter) return false;
      if (filters.team !== "all" && r.teamName !== filters.team) return false;
      if (filters.taskStatus !== "all" && r.taskStatus !== filters.taskStatus) return false;
      if (filters.invoiceStatus !== "all") {
        const isInvoiced = !!r.invoiceInfo;
        if (filters.invoiceStatus === "Yes" && !isInvoiced) return false;
        if (filters.invoiceStatus === "No" && isInvoiced) return false;
      }
      if (filters.paymentStatus !== "all") {
        if (!r.invoiceInfo) return false;
        if (filters.paymentStatus === "Paid" && !r.invoiceInfo.isPaid) return false;
        if (filters.paymentStatus === "Unpaid" && r.invoiceInfo.isPaid) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          r.dtapName.toLowerCase().includes(q) ||
          r.wireCenterName.toLowerCase().includes(q) ||
          r.teamName.toLowerCase().includes(q) ||
          r.terminalName.toLowerCase().includes(q) ||
          r.termPlacement.toLowerCase().includes(q) ||
          r.build.toLowerCase().includes(q) ||
          r.taskStatus.toLowerCase().includes(q) ||
          r.comments.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, debouncedSearch, filters]);

  // Derive invoice number from the loaded records (all share the same invoice when filtered by invoiceId)
  const invoiceNumber = React.useMemo(() => {
    if (!invoiceId || records.length === 0) return null;
    const first = records.find((r) => r.invoiceInfo?.invoiceNumber);
    return first?.invoiceInfo?.invoiceNumber ?? null;
  }, [invoiceId, records]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="DTAP Records"
        description={invoiceId ? `Showing records for Invoice #${invoiceNumber || "…"}` : `${totalCount.toLocaleString()} total records`}
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
            <FilterSelect value={filters.dtap} onValueChange={(v) => setFilter("dtap", v)} placeholder="DTAP" allLabel="All DTAP" options={fo.dtaps || []} className="w-[140px]" />
            <FilterSelect value={filters.wireCenter} onValueChange={(v) => setFilter("wireCenter", v)} placeholder="Wire Center" allLabel="All Wire Centers" options={fo.wireCenters || []} className="w-[150px]" />
            <FilterSelect value={filters.team} onValueChange={(v) => setFilter("team", v)} placeholder="Team" allLabel="All Teams" options={fo.teams || []} className="w-[130px]" />
            <FilterSelect value={filters.taskStatus} onValueChange={(v) => setFilter("taskStatus", v)} placeholder="Task Status" allLabel="All Task Status" options={fo.taskStatuses || []} className="w-[140px]" />
            <FilterSelect value={filters.invoiceStatus} onValueChange={(v) => setFilter("invoiceStatus", v)} placeholder="Invoice Status" allLabel="All Invoice Status" options={["Yes", "No"]} className="w-[150px]" />
            <FilterSelect value={filters.paymentStatus} onValueChange={(v) => setFilter("paymentStatus", v)} placeholder="Payment Status" allLabel="All Payment Status" options={["Paid", "Unpaid"]} className="w-[155px]" />
            {invoiceId && (
              <Button variant="secondary" size="sm" className="h-8 px-2 text-xs" onClick={() => router.push("/dtap-records")}>
                <IconX className="mr-1 size-3" />
                Clear Invoice Filter
              </Button>
            )}

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
        emptyIcon={<IconFileSpreadsheet className="size-10 opacity-40" />}
        emptyMessage={searchQuery || hasActiveFilters ? "No matching records" : "No DTAP records found"}
        renderCell={(row, col) => {
          // Image thumbnails
          if (col.key === "terminalPlacedPicture" || col.key === "terminalTestedPicture") {
            const url = (row as any)[col.key] as string;
            if (!url) return "—";
            return (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewImage({ url, label: col.label }); }}
                className="block rounded overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
              >
                <img src={url} alt={col.label} className="h-8 w-12 object-cover" />
              </button>
            );
          }
          // Invoice status badge (clickable for invoice preview)
          if (col.key === "isInvoice" && col.label === "Invoice Status") {
            const invoiced = !!row.invoiceInfo;
            return (
              <Badge
                variant={invoiced ? "default" : "secondary"}
                className={invoiced ? "cursor-pointer" : ""}
                onClick={invoiced ? (e: React.MouseEvent) => { e.stopPropagation(); setInvoicePreview({ ...row.invoiceInfo!, terminalName: row.terminalName }); } : undefined}
              >
                {invoiced ? "Yes" : "No"}
              </Badge>
            );
          }
          // Payment status badge
          if (col.key === "isInvoice" && col.label === "Payment Status") {
            const inv = row.invoiceInfo;
            if (!inv) return "—";
            return (
              <Badge variant={inv.isPaid ? "default" : "destructive"}>
                {inv.isPaid ? "Paid" : "Unpaid"}
              </Badge>
            );
          }
          return undefined;
        }}
        footerRow={invoiceId ? computeTotals(filteredRecords, columns) : undefined}
      />

      {/* Image Preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{previewImage?.label}</DialogTitle>
          {previewImage && (
            <img src={previewImage.url} alt={previewImage.label} className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Preview */}
      <Dialog open={!!invoicePreview} onOpenChange={() => setInvoicePreview(null)}>
        <DialogContent>
          <DialogTitle>Invoice Details</DialogTitle>
          {invoicePreview && (
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Terminal</span><span className="font-medium">{invoicePreview.terminalName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span className="font-medium">{invoicePreview.invoiceNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Week</span><span className="font-medium">{invoicePreview.week || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{formatDate(invoicePreview.date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><Badge variant={invoicePreview.isPaid ? "default" : "destructive"}>{invoicePreview.isPaid ? "Paid" : "Unpaid"}</Badge></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
