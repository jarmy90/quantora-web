/**
 * Compare basket — shared client state so the tray (catalog) and the compare
 * page stay in sync. Max 3 strategies, per the product spec.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { addToCompare, removeFromCompare } from '../domain/compare';
import { readLocal, writeLocal } from './storage';

const KEY = 'quantora.compare';

type CompareApi = {
  ids: string[];
  isCompared: (id: string) => boolean;
  canAdd: boolean;
  toggle: (id: string) => void;
  clear: () => void;
};

const CompareContext = createContext<CompareApi | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => readLocal<string[]>(KEY, []));

  useEffect(() => {
    writeLocal(KEY, ids);
  }, [ids]);

  const api = useMemo<CompareApi>(
    () => ({
      ids,
      isCompared: (id) => ids.includes(id),
      canAdd: ids.length < 3,
      toggle: (id) =>
        setIds((prev) => (prev.includes(id) ? removeFromCompare(prev, id) : addToCompare(prev, id))),
      clear: () => setIds([]),
    }),
    [ids],
  );

  return <CompareContext.Provider value={api}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareApi {
  const api = useContext(CompareContext);
  if (!api) throw new Error('useCompare must be used inside <CompareProvider>');
  return api;
}
