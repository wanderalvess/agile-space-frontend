'use client';

import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until after `delay` ms of inactivity.
 * Use this to avoid triggering expensive side-effects (Firestore writes, API calls)
 * on every keystroke in text inputs.
 *
 * @param value  The raw value to debounce.
 * @param delay  Delay in milliseconds (default: 600).
 *
 * @example
 * const debouncedQuery = useDebounce(searchInput, 600);
 * useEffect(() => { fetchResults(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 600): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer); // Cleanup on each value change
  }, [value, delay]);

  return debouncedValue;
}
