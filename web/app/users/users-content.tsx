"use client";

import * as React from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PageHeader } from "@/components/page-header";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { cn } from "@/lib/utils";

interface Team {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  status?: string;
  teamId?: string;
  teamName?: string | null;
  teamTier?: string | null;
}

const emptyForm = {
  name: "",
  email: "",
  designation: "",
  status: "Active",
  teamId: "",
};

export function UsersContent() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<User | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { filters, setFilter, searchQuery: urlSearch, setSearchQuery: setUrlSearch, clearFilters, hasActiveFilters } =
    useUrlFilters({
      defaults: { status: "all", designation: "all", team: "all" },
      searchKey: "q",
    });

  // Sync search between local state and URL
  React.useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/teams"),
      ]);
      const [usersData, teamsData] = await Promise.all([
        usersRes.json(),
        teamsRes.json(),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique designations for filter
  const designations = React.useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.designation) set.add(u.designation);
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.designation?.toLowerCase().includes(q) ||
          u.teamName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Status filter
      if (filters.status !== "all" && u.status !== filters.status) return false;
      // Designation filter
      if (filters.designation !== "all" && u.designation !== filters.designation)
        return false;
      // Team filter
      if (filters.team !== "all" && u.teamId !== filters.team) return false;
      return true;
    });
  }, [users, searchQuery, filters]);

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      designation: user.designation || "",
      status: user.status || "Active",
      teamId: user.teamId || "",
    });
    setDialogOpen(true);
  }

  function openDelete(user: User) {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("User updated");
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("User created");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${deletingUser._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("User deleted");
      setDeleteDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Users"
        description="Manage your team members"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9 h-8"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setUrlSearch(e.target.value); }}
            />
          </div>
        }
        filters={
          <>
            <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.designation}
              onValueChange={(v) => setFilter("designation", v)}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                {designations.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.team} onValueChange={(v) => setFilter("team", v)}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <Button onClick={openCreate} size="sm">
            <IconPlus className="mr-1 size-4" />
            Add User
          </Button>
        }
      />

      <div className="flex-1 flex flex-col overflow-auto px-4 py-2">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <FiberLoadingAnimation />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <IconUser className="size-10 opacity-40" />
            <p>{searchQuery || filters.status !== "all" || filters.designation !== "all" || filters.team !== "all" ? "No matching users" : "No users found"}</p>
            {!searchQuery && filters.status === "all" && filters.designation === "all" && filters.team === "all" && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add your first user
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredUsers.map((user) => (
              <Card key={user._id} className="group relative">
                <CardHeader className="flex flex-col items-center gap-1 pb-2 text-center">
                  <CardTitle className="text-sm font-semibold leading-tight truncate w-full">
                    {user.name}
                  </CardTitle>
                  {user.designation && (
                    <p className="text-xs text-muted-foreground">
                      {user.designation}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 pb-3 text-xs text-muted-foreground text-center">
                  <p className="truncate">{user.email}</p>
                  {user.teamName && (
                    <p className="truncate">
                      {user.teamName}{user.teamTier ? ` · ${user.teamTier}` : ""}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-center gap-2 border-t pt-3">
                  <Badge
                    variant={user.status === "Active" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.status || "Active"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openEdit(user)}
                  >
                    <IconEdit className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => openDelete(user)}
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
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update the user details below."
                : "Fill in the details to create a new user."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            {/* Designation — searchable combobox with add new */}
            <div className="grid gap-2">
              <Label>Designation</Label>
              <DesignationCombobox
                value={form.designation}
                options={designations}
                onChange={(val) => setForm({ ...form, designation: val })}
              />
            </div>
            {/* Team & Status — inline */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Team</Label>
                <TeamCombobox
                  value={form.teamId}
                  teams={teams}
                  onChange={(val) => setForm({ ...form, teamId: val })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              {saving ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingUser?.name}
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

/* ─── Designation Combobox ─── */
function DesignationCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const showAddNew = search.trim() && !options.some(
    (o) => o.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select designation..."}
          <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or add..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {showAddNew ? null : "No results found."}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((d) => (
                <CommandItem
                  key={d}
                  value={d}
                  onSelect={() => {
                    onChange(d);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      value === d ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {d}
                </CommandItem>
              ))}
              {showAddNew && (
                <CommandItem
                  value={`__add_${search}`}
                  onSelect={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <IconPlus className="mr-2 size-4" />
                  Add &quot;{search.trim()}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Team Combobox ─── */
function TeamCombobox({
  value,
  teams,
  onChange,
}: {
  value: string;
  teams: { _id: string; name: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedName = teams.find((t) => t._id === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedName || "No Team"}
          <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search teams..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__no_team"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }}
              >
                <IconCheck
                  className={cn(
                    "mr-2 size-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                No Team
              </CommandItem>
              {filtered.map((t) => (
                <CommandItem
                  key={t._id}
                  value={t.name}
                  onSelect={() => {
                    onChange(t._id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      value === t._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
