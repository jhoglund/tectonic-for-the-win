import { createContext, useContext } from 'react';

/**
 * App-wide "auth" state. Since ADR-0020 Tectonic no longer has real
 * authentication: it is single-user and local-first, and profile sync is
 * a Cloudflare Worker keyed by a bearer secret, not a per-user login. The
 * provider (AuthProvider.tsx) reports one constant, always-signed-in user
 * so the sync layer and existing consumers keep a stable identity.
 *
 * The context shape is deliberately unchanged from the Supabase era so
 * consumers (`ProfileProvider`, `SettingsScreen`, `DevTools`, `AuthSheet`)
 * compile without churn. The sign-in actions are now no-ops.
 */

/**
 * - `signed-in`, the sole local user (always, when the app is running).
 * - `loading` / `anonymous` / `disabled` are retained in the type only so
 *   any lingering references still typecheck; the provider never reports
 *   them.
 */
export type AuthStatus = 'loading' | 'anonymous' | 'signed-in' | 'disabled';

export interface AuthUser {
  id: string;
  /** Empty for the local user; kept for shape compatibility. */
  email: string;
  /** Always false, there is one real, local user. */
  isAnonymous: boolean;
}

/** The outcome of an auth action, a friendly message on failure. */
export type AuthResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; message: string };

export interface AuthContextValue {
  status: AuthStatus;
  /** The sole local user. Never `null` while the app is running. */
  user: AuthUser | null;
  /** No-op since ADR-0020 (there is nothing to sign into). */
  signInWithApple: () => Promise<AuthResult>;
  /** No-op since ADR-0020. */
  signInWithGoogle: () => Promise<AuthResult>;
  /** No-op since ADR-0020. */
  signInWithMagicLink: (email: string) => Promise<AuthResult>;
  /** No-op since ADR-0020. */
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Read the auth store. Must be used inside an AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
