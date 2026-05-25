"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconSearch,
  IconDatabase,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, ColumnDef } from "@/components/data-table";
import { FiberLoadingAnimation } from "@/components/fiber-loading";

/* ── Types ── */
interface BspdInfo {
  _id: string;
  feeder: string;
  wireCenter: string;
  cableType: string;
  totalFT: number | null;
  team: string;
  BSPDCompleteInFull: boolean | null;
  completionDate: string;
  invoiceStatus: string;
}

interface BspdRecord {
  _id: string;
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

function formatDate(v: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString(); } catch { return v; }
}

export function BspdDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [bspdInfo, setBspdInfo] = React.useState<BspdInfo | null>(null);
  const [records, setRecords] = React.useState<BspdRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewImage, setPreviewImage] = React.useState<{ url: string; label: string } | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/bspd/${id}`);
        const json = await res.json();
        if (json.bspd) setBspdInfo(json.bspd);
        if (json.data) setRecords(json.data);
      } catch {
        // handled below
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.item.toLowerCase().includes(q) ||
        r.itemDescription.toLowerCase().includes(q) ||
        r.completedBy.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const imageKeys: (keyof BspdRecord)[] = [
    "tickMarkStartPicture",
    "tickMarkEndPicture",
    "redLines",
    "workProcesPicture",
    "additionalPicture",
  ];

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <FiberLoadingAnimation />
      </div>
    );
  }

  if (!bspdInfo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">BSPD item not found</p>
        <Button variant="outline" onClick={() => router.push("/bspd")}>
          <IconArrowLeft className="mr-2 size-4" /> Back to BSPD
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header Row 1 — BSPD info */}
      <div className="shrink-0 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => router.push("/bspd")}
          >
            <IconArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">
            {bspdInfo.feeder}
          </h2>
          <span className="text-muted-foreground/40">|</span>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">
              WC: <span className="text-foreground">{bspdInfo.wireCenter}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Team: <span className="text-foreground">{bspdInfo.team}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Cable: <span className="text-foreground">{bspdInfo.cableType || "—"}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Total ft: <span className="text-foreground">{bspdInfo.totalFT?.toLocaleString() ?? "—"}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <Badge variant={bspdInfo.BSPDCompleteInFull ? "default" : "secondary"}>
              {bspdInfo.BSPDCompleteInFull ? "Complete" : "Incomplete"}
            </Badge>
            <Badge variant="default">
              {bspdInfo.invoiceStatus || "—"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Header Row 2 — Search */}
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
        <span className="text-xs text-muted-foreground">
          {records.length} record{records.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Records table */}
      <DataTable
        columns={columns}
        data={filteredRecords}
        loading={false}
        loadingMore={false}
        hasMore={false}
        totalCount={records.length}
        onLoadMore={() => {}}
        emptyIcon={<IconDatabase className="size-10 opacity-40" />}
        emptyMessage={searchQuery ? "No matching records" : "No BSPD records found"}
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
