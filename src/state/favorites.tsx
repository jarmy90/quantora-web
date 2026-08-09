/**
 * Favorites — client state (localStorage fallback), swappable for a server
 * implementation later. Used by the catalog cards, detail page and dashboard.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readLocal, writeLocal } from './storage';

const KEY = 'quantora.favorites';

type FavoritesApi = {
  ids: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesApi | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => readLocal<string[]>(KEY, []));

  useEffect(() => {
    writeLocal(KEY, ids);
  }, [ids]);

  const api = useMemo<FavoritesApi>(
    () => ({
      ids,
      isFavorite: (id) => ids.includes(id),
      toggle: (id) =>
        setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    }),
    [ids],
  );

  return <FavoritesContext.Provider value={api}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesApi {
  const api = useContext(FavoritesContext);
  if (!api) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return api;
}
