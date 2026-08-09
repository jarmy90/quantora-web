/**
 * Publish drafts store — localStorage fallback with explicit demo semantics.
 * Used by the publish wizard, the creator area and the admin review queue.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublishDraft } from '../domain/publish';
import { readLocal, writeLocal, removeLocal } from './storage';

const KEY = 'quantora.drafts';

type DraftsApi = {
  drafts: PublishDraft[];
  getDraft: (id: string) => PublishDraft | undefined;
  saveDraft: (draft: PublishDraft) => void;
  deleteDraft: (id: string) => void;
};

const DraftsContext = createContext<DraftsApi | null>(null);

export function DraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<PublishDraft[]>(() => readLocal<PublishDraft[]>(KEY, []));

  useEffect(() => {
    writeLocal(KEY, drafts);
  }, [drafts]);

  const api = useMemo<DraftsApi>(
    () => ({
      drafts,
      getDraft: (id) => drafts.find((d) => d.id === id),
      saveDraft: (draft) =>
        setDrafts((prev) => {
          const next = [...prev];
          const index = next.findIndex((d) => d.id === draft.id);
          if (index >= 0) next[index] = draft;
          else next.push(draft);
          return next;
        }),
      deleteDraft: (id) => {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        removeLocal(`${'quantora.draft.'}${id}`);
      },
    }),
    [drafts],
  );

  return <DraftsContext.Provider value={api}>{children}</DraftsContext.Provider>;
}

export function useDrafts(): DraftsApi {
  const api = useContext(DraftsContext);
  if (!api) throw new Error('useDrafts must be used inside <DraftsProvider>');
  return api;
}
