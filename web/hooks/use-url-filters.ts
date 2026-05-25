"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * A hook that syncs filter/search state with URL query parameters.
 *
 * Usage:
 *   const { filters, setFilter, searchQuery, setSearchQuery, clearFilters, hasActiveFilters } =
 *     useUrlFilters({ payment: "all", wireCenter: "all", dtap: "all" });
 *
 * - Filter values default to "all" (not shown in URL).
 * - Search is synced as `?q=...`.
 * - Changing any filter/search updates the URL without a full page reload.
 */

interface UseUrlFiltersOptions<K extends string> {
  /** Default values for each filter key. Use "all" for unset. */
  defaults: Record<K, string>;
  /** Query param key for the search field. Defaults to "q". */
  searchKey?: string;
  /** Keys to preserve in the URL that are NOT managed by this hook (e.g. "invoiceId"). */
  preserveKeys?: string[];
}

interface UseUrlFiltersReturn<K extends string> {
  filters: Record<K, string>;
  setFilter: (key: K, value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useUrlFilters<K extends string>(
  options: UseUrlFiltersOptions<K>
): UseUrlFiltersReturn<K> {
  const { defaults, searchKey = "q", preserveKeys = [] } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterKeys = Object.keys(defaults) as K[];

  // Initialize filters from URL on first render
  const initialFilters = React.useMemo(() => {
    const result = { ...defaults };
    for (const key of filterKeys) {
      const urlValue = searchParams.get(key);
      if (urlValue) result[key] = urlValue;
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const [filters, setFiltersState] = React.useState<Record<K, string>>(initialFilters);
  const [searchQuery, setSearchQueryState] = React.useState(
    searchParams.get(searchKey) || ""
  );

  // Use ref for searchParams to keep updateUrl stable (prevents infinite loop:
  // router.replace → searchParams changes → updateUrl recreated → useEffect fires → repeat)
  const searchParamsRef = React.useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Update URL when filters or search change
  const updateUrl = React.useCallback(
    (newFilters: Record<K, string>, newSearch: string) => {
      const params = new URLSearchParams();

      // Preserve external keys (e.g., invoiceId)
      for (const key of preserveKeys) {
        const val = searchParamsRef.current.get(key);
        if (val) params.set(key, val);
      }

      // Set filter params (skip defaults / "all")
      for (const key of filterKeys) {
        const val = newFilters[key];
        if (val && val !== "all" && val !== defaults[key]) {
          params.set(key, val);
        }
      }

      // Set search
      if (newSearch.trim()) {
        params.set(searchKey, newSearch.trim());
      }

      const qs = params.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;
      // Guard: skip router.replace if URL is unchanged (prevents infinite loop
      // from React Strict Mode double-firing the sync effect on mount)
      const currentQs = searchParamsRef.current.toString();
      const currentUrl = currentQs ? `${pathname}?${currentQs}` : pathname;
      if (newUrl !== currentUrl) {
        router.replace(newUrl, { scroll: false });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );
  // Sync URL reactively after state changes (avoids calling router.replace inside setState)
  // Skip on mount — URL already has correct state from initialization, and calling
  // router.replace on mount causes Next.js to re-render which restarts data fetching.
  const hasMountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    updateUrl(filters, searchQuery);
  }, [filters, searchQuery, updateUrl]);

  const setFilter = React.useCallback(
    (key: K, value: string) => {
      setFiltersState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setSearchQuery = React.useCallback(
    (value: string) => {
      setSearchQueryState(value);
    },
    []
  );

  const clearFilters = React.useCallback(() => {
    setFiltersState({ ...defaults });
  }, [defaults]);

  const hasActiveFilters = React.useMemo(
    () => filterKeys.some((key) => filters[key] !== "all" && filters[key] !== defaults[key]),
    [filters, filterKeys, defaults]
  );

  return {
    filters,
    setFilter,
    searchQuery,
    setSearchQuery,
    clearFilters,
    hasActiveFilters,
  };
}
