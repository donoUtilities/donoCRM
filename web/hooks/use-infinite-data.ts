"use client";

import * as React from "react";
import { toast } from "sonner";

interface UseInfiniteDataOptions {
  apiUrl: string;
  pageSize?: number;
  /** Server-side filter params to append to the API URL. When these change, data resets and re-fetches from page 1. */
  filters?: Record<string, string>;
}

interface UseInfiniteDataReturn<T> {
  records: T[];
  loading: boolean;
  loadingMore: boolean;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
  /** Filter options returned by API on first page (distinct values from full DB) */
  filterOptions: Record<string, string[]>;
  fetchPage: (page: number, append?: boolean) => Promise<void>;
  loadMore: () => void;
  reset: () => void;
  updateRecord: (id: string, updates: Partial<T>) => void;
}

export function useInfiniteData<T>(options: UseInfiniteDataOptions): UseInfiniteDataReturn<T> {
  const { apiUrl, filters } = options;
  const [records, setRecords] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filterOptions, setFilterOptions] = React.useState<Record<string, string[]>>({});

  // Build a stable query string from filters (excluding "all" values)
  const filterQueryString = React.useMemo(() => {
    if (!filters) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== "all") {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? qs : "";
  }, [filters]);

  // AbortController to cancel stale fetches when filters change
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const fetchPage = React.useCallback(async (page: number, append = false, signal?: AbortSignal) => {
    if (append) setLoadingMore(true); else setLoading(true);
    let aborted = false;
    try {
      const separator = apiUrl.includes("?") ? "&" : "?";
      let url = `${apiUrl}${separator}page=${page}`;
      // Append server-side filter params
      if (filterQueryString) {
        url += `&${filterQueryString}`;
      }
      const res = await fetch(url, { signal });
      const json = await res.json();

      // Support both paginated { data, totalCount } and plain array responses
      if (json.data && Array.isArray(json.data)) {
        setRecords((prev) => append ? [...prev, ...json.data] : json.data);
        setCurrentPage(json.page || page);
        setTotalCount(json.totalCount || 0);
        setTotalPages(json.totalPages || 1);
        // Capture filterOptions from page 1 response (only sent on first page)
        if (json.filterOptions && !append) {
          setFilterOptions(json.filterOptions);
        }
      } else if (Array.isArray(json)) {
        // Non-paginated API — treat as single page
        setRecords(json);
        setCurrentPage(1);
        setTotalCount(json.length);
        setTotalPages(1);
      } else if (!append) {
        setRecords([]);
        toast.error("Failed to load data");
      }
    } catch (err: unknown) {
      // Don't show error or change loading state for intentionally aborted requests
      if (err instanceof DOMException && err.name === "AbortError") {
        aborted = true;
        return;
      }
      toast.error("Failed to load data");
    } finally {
      // Skip loading reset for aborted requests — a new fetch is already in flight
      if (!aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [apiUrl, filterQueryString]);

  const loadMore = React.useCallback(() => {
    if (!loading && !loadingMore && currentPage < totalPages) {
      fetchPage(currentPage + 1, true);
    }
  }, [loading, loadingMore, currentPage, totalPages, fetchPage]);

  const reset = React.useCallback(() => {
    setRecords([]);
    setCurrentPage(1);
    setTotalCount(0);
    setTotalPages(1);
    setFilterOptions({});
    fetchPage(1);
  }, [fetchPage]);

  // Re-fetch from page 1 whenever apiUrl or filters change
  // Abort any in-flight request first to prevent stale responses overwriting fresh data
  React.useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchPage(1, false, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  const updateRecord = React.useCallback((id: string, updates: Partial<T>) => {
    setRecords((prev) =>
      prev.map((r) => {
        if ((r as Record<string, unknown>)._id === id) {
          return { ...r, ...updates };
        }
        return r;
      })
    );
  }, []);

  return {
    records,
    loading,
    loadingMore,
    totalCount,
    totalPages,
    currentPage,
    hasMore: currentPage < totalPages,
    filterOptions,
    fetchPage,
    loadMore,
    reset,
    updateRecord,
  };
}
