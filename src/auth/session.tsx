/**
 * Session & roles contract (Phase 1 demo).
 *
 * There is NO real authentication in Phase 1 — by design. This module defines
 * the swappable contract the product will use later:
 *   - `Role`: visitor | user | creator | admin
 *   - `SessionProvider` / `useSession`: the single access point
 *   - `RequireRole`: declarative guard
 *
 * The demo provider stores the role in-memory (with a dev-only demo switcher on
 * the admin page). Replacing it with a real auth provider later must not touch
 * any route: swap the provider implementation only.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Role = 'visitor' | 'user' | 'creator' | 'admin';

export type Session = {
  role: Role;
  /** Demo-only: switches the local role so the admin base can be previewed. */
  setRole: (role: Role) => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('visitor');
  const value = useMemo(() => ({ role, setRole }), [role]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}

export const ROLE_LABEL: Record<Role, string> = {
  visitor: 'Visitor',
  user: 'User',
  creator: 'Creator',
  admin: 'Admin',
};

/**
 * Declarative role guard. Renders `children` only when the session role is
 * in `allowed`; otherwise renders a friendly access screen (no redirect loop,
 * no fake auth — the demo switcher lives on the admin page itself).
 */
export function RequireRole({
  allowed,
  children,
  denied,
}: {
  allowed: Role[];
  children: ReactNode;
  denied: ReactNode;
}) {
  const { role } = useSession();
  if (allowed.includes(role)) return <>{children}</>;
  return <>{denied}</>;
}
