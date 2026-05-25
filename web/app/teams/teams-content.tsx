"use client";

import * as React from "react";
import {
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsersGroup,
} from "@tabler/icons-react";
import { toast } from "sonner";

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

interface Team {
  _id: string;
  name: string;
  tier?: string;
}

export function TeamsContent() {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = React.useState<Team | null>(null);
  const [name, setName] = React.useState("");
  const [tier, setTier] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredTeams = React.useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter((t) => t.name?.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  const fetchTeams = React.useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      setTeams(data);
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  function openCreate() {
    setEditingTeam(null);
    setName("");
    setTier("");
    setDialogOpen(true);
  }

  function openEdit(team: Team) {
    setEditingTeam(team);
    setName(team.name);
    setTier(team.tier || "");
    setDialogOpen(true);
  }

  function openDelete(team: Team) {
    setDeletingTeam(team);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingTeam) {
        const res = await fetch(`/api/teams/${editingTeam._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, tier }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Team updated");
      } else {
        const res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, tier }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Team created");
      }
      setDialogOpen(false);
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTeam) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${deletingTeam._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Team deleted");
      setDeleteDialogOpen(false);
      fetchTeams();
    } catch {
      toast.error("Failed to delete team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Teams"
        description="Manage your teams"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              className="pl-9 h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        }
        actions={
          <Button onClick={openCreate} size="sm">
            <IconPlus className="mr-1 size-4" />
            Add Team
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Loading...
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <IconUsersGroup className="size-10 opacity-40" />
            <p>{searchQuery ? "No matching teams" : "No teams found"}</p>
            {!searchQuery && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add your first team
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTeams.map((team) => (
              <Card key={team._id}>
                <CardHeader className="flex flex-col items-center gap-1 pb-2 text-center">
                  <CardTitle className="text-sm font-semibold truncate w-full">
                    {team.name}
                  </CardTitle>
                  {team.tier && (
                    <p className="text-xs text-muted-foreground">{team.tier}</p>
                  )}
                </CardHeader>
                <CardFooter className="flex justify-center gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openEdit(team)}
                  >
                    <IconEdit className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => openDelete(team)}
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
              {editingTeam ? "Edit Team" : "Add New Team"}
            </DialogTitle>
            <DialogDescription>
              {editingTeam
                ? "Update the team name."
                : "Enter a name for the new team."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="teamName">Name</Label>
              <Input
                id="teamName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Construction"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="teamTier">Tier</Label>
              <Input
                id="teamTier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                placeholder="e.g. Tier 1"
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
              {saving ? "Saving..." : editingTeam ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingTeam?.name}
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
