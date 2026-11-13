'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Auto-unwrap API responses.
 * Backend endpoints often return { data: [...] } or { activities: [...] }.
 * If the caller expects an array (T extends any[]), we try to extract it.
 */
function unwrapResponse(body: any): any {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const keys = Object.keys(body);
    // If there's a single key containing an array, unwrap it
    if (keys.length === 1 && Array.isArray(body[keys[0]])) {
      return body[keys[0]];
    }
    // Common wrapper keys
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.activities)) return body.activities;
    if (Array.isArray(body.results)) return body.results;
    if (Array.isArray(body.items)) return body.items;
  }
  return body;
}

export function useApi<T>(fetcher: () => Promise<{ data: T }>, deps: any[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  const fetchData = useCallback(async () => {
    if (isFirstLoad.current) {
      setLoading(true);
      isFirstLoad.current = false;
    }
    setError(null);
    try {
      const response = await fetcher();
      setData(unwrapResponse(response.data));
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

