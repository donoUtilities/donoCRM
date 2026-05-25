"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconEdit,
  IconSearch,
  IconTrash,
  IconFileSpreadsheet,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, ColumnDef } from "@/components/data-table";

/* ── Types ── */
interface DtapInfo {
  _id: string;
  dtap: string;
  wireCenterName: string;
  teamName: string;
  completionStatus: string;
  testingStatus: string;
  requestedTimeStamp: string;
  invoiceStatus: string;
}

interface DtapRecord {
  _id: string;
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

/* ── Helpers ── */
function statusVariant(
  s: string
): "default" | "secondary" | "destructive" | "outline" {
  const l = (s || "").toLowerCase();
  if (["complete", "completed", "tested", "invoiced"].includes(l))
    return "default";
  if (["incomplete", "pending"].includes(l)) return "secondary";
  if (["failed", "rejected"].includes(l)) return "destructive";
  return "outline";
}

function formatDate(ts: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ts;
  }
}

/* ── Column definition ── */
const columns: ColumnDef<DtapRecord>[] = [
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

/* ── Component ── */
export function DtapDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [dtap, setDtap] = React.useState<DtapInfo | null>(null);
  const [records, setRecords] = React.useState<DtapRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewImage, setPreviewImage] = React.useState<{ url: string; label: string } | null>(null);
  const [invoicePreview, setInvoicePreview] = React.useState<{
    invoiceNumber: string;
    date: string;
    isPaid: boolean;
    week: string;
    terminalName: string;
  } | null>(null);

  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.terminalName.toLowerCase().includes(q) ||
        r.termPlacement.toLowerCase().includes(q) ||
        r.build.toLowerCase().includes(q) ||
        r.taskStatus.toLowerCase().includes(q) ||
        r.comments.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/dtap/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setDtap(data.dtap);
        setRecords(data.records);
      } catch {
        toast.error("Failed to load DTAP detail");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!dtap) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full text-muted-foreground">
        <p>DTAP not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dtap")}>
          Back to DTAP list
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header Row 1 — DTAP info */}
      <div className="shrink-0 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => router.push("/dtap")}
          >
            <IconArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">
            {dtap.dtap}
          </h2>
          <span className="text-muted-foreground/40">|</span>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">
              WC: <span className="text-foreground">{dtap.wireCenterName}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Team: <span className="text-foreground">{dtap.teamName}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Requested: <span className="text-foreground">{formatDate(dtap.requestedTimeStamp)}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <Badge variant={statusVariant(dtap.completionStatus)}>
              {dtap.completionStatus}
            </Badge>
            <Badge variant={statusVariant(dtap.testingStatus)}>
              {dtap.testingStatus}
            </Badge>
            <Badge variant={statusVariant(dtap.invoiceStatus)}>
              {dtap.invoiceStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Header Row 2 — Search & actions */}
      <div className="shrink-0 bg-background border-b px-4 py-2 flex items-center gap-3">
        <div className="flex-1">
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              className="pl-9 h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <IconEdit className="mr-1 size-4" />
            Edit
          </Button>
          <Button variant="destructive" size="sm">
            <IconTrash className="mr-1 size-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredRecords}
        loading={false}
        loadingMore={false}
        hasMore={false}
        totalCount={records.length}
        onLoadMore={() => {}}
        emptyIcon={<IconFileSpreadsheet className="size-10 opacity-40" />}
        emptyMessage={searchQuery ? "No matching records" : "No DTAP records found"}
        renderCell={(row, col) => {
          // Image thumbnails
          if (col.key === "terminalPlacedPicture" || col.key === "terminalTestedPicture") {
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
          // Invoice status badge (clickable for invoice preview)
          if (col.key === "isInvoice" && col.label === "Invoice Status") {
            const invoiced = !!row.invoiceInfo;
            return (
              <Badge
                variant={invoiced ? "default" : "secondary"}
                className={invoiced ? "cursor-pointer" : ""}
                onClick={
                  invoiced && row.invoiceInfo
                    ? (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setInvoicePreview({
                          ...row.invoiceInfo!,
                          terminalName: row.terminalName,
                        });
                      }
                    : undefined
                }
              >
                {invoiced ? "Yes" : "No"}
              </Badge>
            );
          }
          // Payment status badge
          if (col.key === "isInvoice" && col.label === "Payment Status") {
            const inv = row.invoiceInfo;
            if (!inv) return <span className="text-muted-foreground">—</span>;
            return (
              <Badge variant={inv.isPaid ? "default" : "destructive"}>
                {inv.isPaid ? "Paid" : "Unpaid"}
              </Badge>
            );
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

      {/* Invoice Preview Dialog */}
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
