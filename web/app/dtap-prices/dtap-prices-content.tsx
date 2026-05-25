"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconCurrencyDollar,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/page-header";
import { DataTable, ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";

interface DtapPrice {
  _id: string;
  itemNumber: string;
  jumperFootage: number | null;
  itemDescription: string;
  uom: string;
  type: string;
  category: string;
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
  salePrice: number | null;
}

const emptyForm = {
  itemNumber: "",
  jumperFootage: "",
  itemDescription: "",
  uom: "",
  type: "",
  category: "",
  tier1: "",
  tier2: "",
  tier3: "",
  salePrice: "",
};

const columns: ColumnDef<DtapPrice>[] = [
  { label: "Item Number", key: "itemNumber" },
  { label: "Jumper Footage", key: "jumperFootage", type: "number" },
  { label: "Item Description", key: "itemDescription" },
  { label: "UOM", key: "uom" },
  { label: "Type", key: "type", type: "badge" },
  { label: "Category", key: "category", type: "badge" },
  { label: "Tier 1", key: "tier1", type: "dollar" },
  { label: "Tier 2", key: "tier2", type: "dollar" },
  { label: "Tier 3", key: "tier3", type: "dollar" },
  { label: "Sale Price", key: "salePrice", type: "dollar" },
];

export function DtapPricesContent() {
  const { records, loading, loadingMore, totalCount, hasMore, loadMore, reset, filterOptions } =
    useInfiniteData<DtapPrice>({ apiUrl: "/api/dtap-prices" });

  const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { type: "all", category: "all" },
    });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<DtapPrice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingRecord, setDeletingRecord] = React.useState<DtapPrice | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const fo = filterOptions;

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (filters.type !== "all" && r.type !== filters.type) return false;
      if (filters.category !== "all" && r.category !== filters.category) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.itemNumber.toLowerCase().includes(q) ||
          r.itemDescription.toLowerCase().includes(q) ||
          r.uom.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, searchQuery, filters]);

  /* ── CRUD handlers ── */
  function openCreate() {
    setEditingRecord(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(record: DtapPrice) {
    setEditingRecord(record);
    setForm({
      itemNumber: record.itemNumber,
      jumperFootage: record.jumperFootage?.toString() ?? "",
      itemDescription: record.itemDescription,
      uom: record.uom,
      type: record.type,
      category: record.category,
      tier1: record.tier1?.toString() ?? "",
      tier2: record.tier2?.toString() ?? "",
      tier3: record.tier3?.toString() ?? "",
      salePrice: record.salePrice?.toString() ?? "",
    });
    setDialogOpen(true);
  }

  function openDelete(record: DtapPrice) {
    setDeletingRecord(record);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        itemNumber: form.itemNumber,
        jumperFootage: form.jumperFootage ? Number(form.jumperFootage) : null,
        itemDescription: form.itemDescription,
        uom: form.uom,
        type: form.type,
        category: form.category,
        tier1: form.tier1 ? Number(form.tier1) : null,
        tier2: form.tier2 ? Number(form.tier2) : null,
        tier3: form.tier3 ? Number(form.tier3) : null,
        salePrice: form.salePrice ? Number(form.salePrice) : null,
      };
      const url = editingRecord
        ? `/api/dtap-prices/${editingRecord._id}`
        : "/api/dtap-prices";
      const method = editingRecord ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(editingRecord ? "Price updated successfully" : "Price created successfully");
      setDialogOpen(false);
      reset();
    } catch {
      toast.error("Failed to save price");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRecord) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dtap-prices/${deletingRecord._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Price deleted successfully");
      setDeleteDialogOpen(false);
      reset();
    } catch {
      toast.error("Failed to delete price");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="DTAP Prices"
        description="Manage DTAP pricing items"
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
            <FilterSelect value={filters.type} onValueChange={(v) => setFilter("type", v)} placeholder="Type" allLabel="All Types" options={fo.types || []} className="w-[130px]" />
            <FilterSelect value={filters.category} onValueChange={(v) => setFilter("category", v)} placeholder="Category" allLabel="All Categories" options={fo.categories || []} className="w-[130px]" />

          </>
        }
        actions={
          <Button size="sm" onClick={openCreate}>
            <IconPlus className="mr-1 size-4" />
            Add Price
          </Button>
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
        emptyMessage={searchQuery || hasActiveFilters ? "No matching prices" : "No DTAP prices found"}
        renderCell={(row, col) => {
          // Type badge as outline
          if (col.key === "type") {
            return <Badge variant="outline">{row.type || "—"}</Badge>;
          }
          // Category badge as secondary
          if (col.key === "category") {
            return <Badge variant="secondary">{row.category || "—"}</Badge>;
          }
          return undefined;
        }}
        // We need an extra Actions column — handled via onRowClick workaround
        // Instead, we use renderCell for last-column actions
      />

      {/* Floating edit/delete: we add row click to open edit */}
      {/* For now, users can edit via row click */}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Edit DTAP Price" : "Add New DTAP Price"}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? "Update the price details below."
                : "Fill in the details to create a new price."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="itemNumber">Item Number</Label>
                <Input
                  id="itemNumber"
                  value={form.itemNumber}
                  onChange={(e) => setForm({ ...form, itemNumber: e.target.value })}
                  placeholder="e.g. BSPDA1000A"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jumperFootage">Jumper Footage</Label>
                <Input
                  id="jumperFootage"
                  type="number"
                  value={form.jumperFootage}
                  onChange={(e) => setForm({ ...form, jumperFootage: e.target.value })}
                  placeholder="e.g. 1000"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemDescription">Item Description</Label>
              <Input
                id="itemDescription"
                value={form.itemDescription}
                onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
                placeholder="e.g. Aerial Additional 1000ft Pushlok Drop"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="uom">UOM</Label>
                <Input
                  id="uom"
                  value={form.uom}
                  onChange={(e) => setForm({ ...form, uom: e.target.value })}
                  placeholder="e.g. EACH"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="e.g. Additional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Aerial"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tier1">Tier 1 ($)</Label>
                <Input id="tier1" type="number" value={form.tier1} onChange={(e) => setForm({ ...form, tier1: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier2">Tier 2 ($)</Label>
                <Input id="tier2" type="number" value={form.tier2} onChange={(e) => setForm({ ...form, tier2: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier3">Tier 3 ($)</Label>
                <Input id="tier3" type="number" value={form.tier3} onChange={(e) => setForm({ ...form, tier3: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="salePrice">Sale Price ($)</Label>
                <Input id="salePrice" type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingRecord ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Price</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingRecord?.itemNumber}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
