"use client";

import * as React from "react";
import { IconCheck, IconSelector, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  allLabel: string;
  options: string[];
  className?: string;
}

export function FilterSelect({
  value,
  onValueChange,
  placeholder,
  allLabel,
  options,
  className,
}: FilterSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const displayValue = value === "all" ? allLabel : value;

  React.useEffect(() => setMounted(true), []);

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search]);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        className={cn(
          "h-8 justify-between text-xs font-normal gap-1 text-muted-foreground",
          className
        )}
      >
        <span className="truncate">{displayValue}</span>
        <IconSelector className="size-3 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between text-xs font-normal gap-1",
            !value || value === "all" ? "text-muted-foreground" : "",
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <IconSelector className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-2">
            <IconSearch className="size-3 shrink-0 text-muted-foreground" />
            <input
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="flex h-8 w-full bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[224px] overflow-y-auto p-1">
            {/* "All" option */}
            <button
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                value === "all" && "bg-accent"
              )}
              onClick={() => { onValueChange("all"); setOpen(false); }}
            >
              <IconCheck className={cn("mr-1 size-3", value === "all" ? "opacity-100" : "opacity-0")} />
              {allLabel}
            </button>
            {filteredOptions.length === 0 && (
              <p className="text-xs py-4 text-center text-muted-foreground">No results.</p>
            )}
            {filteredOptions.map((opt) => (
              <button
                key={opt}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                  value === opt && "bg-accent"
                )}
                onClick={() => { onValueChange(opt); setOpen(false); }}
              >
                <IconCheck className={cn("mr-1 size-3", value === opt ? "opacity-100" : "opacity-0")} />
                {opt}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
