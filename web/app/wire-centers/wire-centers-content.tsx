"use client";

import * as React from "react";
import {
  IconEdit,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { FiberLoadingAnimation } from "@/components/fiber-loading";

interface WireCenter {
  _id: string;
  name: string;
}

export function WireCentersContent() {
  const { data: session } = useSession();
  const [items, setItems] = React.useState<WireCenter[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<WireCenter | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<WireCenter | null>(
    null
  );
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((i) => i.name?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const fetchItems = React.useCallback(async () => {
    try {
      const res = await fetch("/api/wire-centers");
      const data = await res.json();
      setItems(data);
    } catch {
      toast.error("Failed to load wire centers");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function openCreate() {
    setEditingItem(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(item: WireCenter) {
    setEditingItem(item);
    setName(item.name);
    setDialogOpen(true);
  }

  function openDelete(item: WireCenter) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Wire center name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        const res = await fetch(`/api/wire-centers/${editingItem._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Wire center updated");
      } else {
        const res = await fetch("/api/wire-centers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Wire center created");
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/wire-centers/${deletingItem._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Wire center deleted");
      setDeleteDialogOpen(false);
      fetchItems();
    } catch {
      toast.error("Failed to delete wire center");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/wire-centers/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync wire centers");
      }
      toast.success(data.message || "Wire centers synced successfully");
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Wire Centers"
        description="Manage wire centers"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search wire centers..."
              className="pl-9 h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        }
        actions={
          <>
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
            <Button onClick={openCreate} size="sm" disabled={syncing}>
              <IconPlus className="mr-1 size-4" />
              Add Wire Center
            </Button>
          </>
        }
      />

      <div className="flex-1 flex flex-col overflow-auto px-4 py-2">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <FiberLoadingAnimation />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <IconMapPin className="size-10 opacity-40" />
            <p>{searchQuery ? "No matching wire centers" : "No wire centers found"}</p>
            {!searchQuery && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add your first wire center
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <Card key={item._id}>
                <CardHeader className="flex flex-col items-center gap-1 pb-2 text-center">
                  <CardTitle className="text-sm font-semibold truncate w-full">
                    {item.name}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex justify-center gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openEdit(item)}
                  >
                    <IconEdit className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => openDelete(item)}
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Wire Center" : "Add New Wire Center"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the wire center name."
                : "Enter a name for the new wire center."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="wcName">Name</Label>
              <Input
                id="wcName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ponder"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wire Center</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingItem?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
