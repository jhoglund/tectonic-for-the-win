import type { ReactNode } from 'react';
import {
  AuthContext,
  type AuthResult,
  type AuthUser,
} from './authContext';

/**
 * The sole, constant local user (ADR-0020). Tectonic is single-user and
 * local-first; there is no login. This id is the stable key the profile
 * sync layer uses so ProfileProvider's pull/push effects fire exactly as
 * they did under the old auth, just with one fixed identity.
 */
const LOCAL_USER: AuthUser = {
  id: 'local',
  email: '',
  isAnonymous: false,
};

/** Sign-in actions are no-ops since there is nothing to sign into. */
const noopResult: AuthResult = { ok: true };
const noopAction = async (): Promise<AuthResult> => noopResult;
const noopSignOut = async (): Promise<void> => {};

/**
 * Reports one constant, always-signed-in user. Replaces the Supabase-backed
 * provider (ADR-0020, supersedes ADR-0013 / ADR-0017): no anonymous
 * bootstrap, no OAuth, no magic link, no session listener. The context
 * shape is unchanged so `ProfileProvider` and the Settings/DevTools
 * consumers compile untouched.
 *
 * Mount this *outside* ProfileProvider: the profile-sync layer reads this
 * context to get the user id.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: LOCAL_USER,
        signInWithApple: noopAction,
        signInWithGoogle: noopAction,
        signInWithMagicLink: noopAction,
        signOut: noopSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
