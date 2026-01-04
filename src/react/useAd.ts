import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdClient } from './AdContext';
import type { AdResponse, AdError, FetchAdOptions } from '../core/types';

/**
 * State returned by the useAd hook
 */
export interface UseAdState {
  /** The ad data if successfully fetched */
  readonly data: AdResponse | null;
  /** Whether the ad is currently being fetched */
  readonly loading: boolean;
  /** Error if the fetch failed */
  readonly error: AdError | null;
  /** Whether an ad is available */
  readonly hasAd: boolean;
}

/**
 * Actions returned by the useAd hook
 */
export interface UseAdActions {
  /** Manually refetch the ad */
  readonly refetch: () => Promise<void>;
  /** Clear the current ad data and error */
  readonly reset: () => void;
}

/**
 * Options for the useAd hook
 */
export interface UseAdOptions extends FetchAdOptions {
  /** Whether to fetch the ad immediately (default: true) */
  readonly enabled?: boolean;
  /** Callback when ad is successfully fetched */
  readonly onSuccess?: (data: AdResponse) => void;
  /** Callback when fetch fails */
  readonly onError?: (error: AdError) => void;
  /** Callback when no ad is available */
  readonly onEmpty?: () => void;
}

/**
 * Hook return type
 */
export type UseAdResult = UseAdState & UseAdActions;

/**
 * React hook for fetching and managing ad data
 * @param zone - The zone slug to fetch an ad for
 * @param options - Optional configuration
 * @returns State and actions for the ad
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useAd('homepage-banner');
 *
 * if (loading) return <Skeleton />;
 * if (error) return <p>Failed to load ad</p>;
 * if (!data) return null;
 *
 * return <img src={data.imageUrl} alt={data.altText} />;
 * ```
 */
export function useAd(zone: string, options: UseAdOptions = {}): UseAdResult {
  const client = useAdClient();
  const { enabled = true, onSuccess, onError, onEmpty, ...fetchOptions } = options;

  const [state, setState] = useState<UseAdState>({
    data: null,
    loading: enabled,
    error: null,
    hasAd: false,
  });

  // Keep track of whether the component is mounted
  const isMountedRef = useRef(true);

  // Keep track of the current request to handle race conditions
  const requestIdRef = useRef(0);

  // Store callbacks in refs to avoid dependency changes
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onEmptyRef = useRef(onEmpty);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onEmptyRef.current = onEmpty;
  }, [onSuccess, onError, onEmpty]);

  /**
   * Fetches the ad data
   */
  const fetchAd = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const response = await client.fetchAd(zone, fetchOptions);

      // Check if this request is still the latest one
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Check if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      if (response === null) {
        setState({
          data: null,
          loading: false,
          error: null,
          hasAd: false,
        });
        onEmptyRef.current?.();
      } else {
        setState({
          data: response,
          loading: false,
          error: null,
          hasAd: true,
        });
        onSuccessRef.current?.(response);
      }
    } catch (err) {
      // Check if this request is still the latest one
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Check if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      const adError = err as AdError;
      setState({
        data: null,
        loading: false,
        error: adError,
        hasAd: false,
      });
      onErrorRef.current?.(adError);
    }
  }, [client, zone, fetchOptions.context, fetchOptions.timeout, fetchOptions.signal]);

  /**
   * Manually trigger a refetch
   */
  const refetch = useCallback(async () => {
    await fetchAd();
  }, [fetchAd]);

  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    requestIdRef.current++;
    setState({
      data: null,
      loading: false,
      error: null,
      hasAd: false,
    });
  }, []);

  // Fetch on mount and when zone changes
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && zone) {
      void fetchAd();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, zone, fetchAd]);

  return {
    ...state,
    refetch,
    reset,
  };
}

/**
 * Hook for prefetching an ad without rendering it
 * Useful for warming the cache before the ad is needed
 */
export function usePrefetchAd(zone: string): () => Promise<AdResponse | null> {
  const client = useAdClient();

  return useCallback(async () => {
    try {
      return await client.fetchAd(zone);
    } catch {
      return null;
    }
  }, [client, zone]);
}
