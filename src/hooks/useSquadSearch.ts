'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { onboardingService, type OnboardingRoster } from '@/services/onboardingService';
import { isSearchable, normalizeQuery, searchPhaseOf, type SearchPhase } from '@/lib/onboarding';

export const SEARCH_DEBOUNCE_MS = 350;

export interface SquadSearch {
  query: string;
  setQuery: (value: string) => void;
  phase: SearchPhase;
  results: OnboardingRoster[];
  /** Texto da última busca respondida (para "Nenhuma squad encontrada com ..."). */
  searchedText: string;
  retry: () => void;
}

/**
 * Busca de squad no onboarding: espera a pessoa parar de digitar, ignora respostas fora de ordem e
 * distingue "digite mais", "buscando", "sem resultado" e "falhou" (rede), que antes eram a mesma lista vazia.
 */
export function useSquadSearch(active: boolean): SquadSearch {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<OnboardingRoster[]>([]);
  const [searchedText, setSearchedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    const text = normalizeQuery(debounced);
    if (!isSearchable(text)) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let stale = false;
    setLoading(true);
    setFailed(false);
    onboardingService
      .search(text)
      .then((found) => {
        if (stale) return;
        setResults(found);
        setSearchedText(text);
      })
      .catch(() => {
        if (stale) return;
        setResults([]);
        setFailed(true);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [debounced, active, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Enquanto o tempo de espera da digitação não passou, já mostra "buscando": a lista antiga não vale mais.
  const waiting = isSearchable(query) && normalizeQuery(query) !== normalizeQuery(debounced);
  const phase = searchPhaseOf({ query, loading: loading || waiting, failed, count: results.length });

  return { query, setQuery, phase, results, searchedText, retry };
}
