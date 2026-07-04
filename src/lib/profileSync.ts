/**
 * Profile sync — the account-backed half of the local-first profile
 * (ADR-0020, supersedes ADR-0013). The local profile stays the working
 * copy; when sync is configured, ProfileProvider uses these helpers to
 * pull the server copy on start-up and push local changes up.
 *
 * The backend is a small Cloudflare Worker + KV (see `sync-worker/`),
 * called with a single bearer secret. Tectonic is single-user, so there
 * is exactly one stored profile; the `userId` argument is kept for a
 * stable call shape (ProfileProvider passes the fixed local user id) but
 * the Worker addresses the one profile directly.
 *
 * Reconciliation is last-write-wins on the whole blob, by `updatedAt`.
 * Field-level merge (max streak, union solve history) is a noted
 * future refinement.
 */
import { syncConfig } from './syncConfig';
import { normalizeProfile, type PlayerProfile } from './profile';

/** Lifecycle of the sync layer, surfaced to the Settings UI. */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

function authHeaders(secret: string): HeadersInit {
  return { Authorization: `Bearer ${secret}` };
}

/**
 * Fetch the stored profile, or `null` when nothing is stored yet (a
 * first-ever sync). Throws on a transport error. `_userId` is accepted
 * for a stable call shape; the single-user Worker ignores it.
 */
export async function fetchRemoteProfile(
  _userId: string,
): Promise<PlayerProfile | null> {
  if (!syncConfig) return null;
  const res = await fetch(`${syncConfig.url}/profile`, {
    headers: authHeaders(syncConfig.secret),
  });
  // No row yet, the Worker returns 404 when the key is absent.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sync fetch failed: ${res.status}`);
  const blob = (await res.json()) as unknown;
  if (!blob || typeof blob !== 'object') return null;
  return normalizeProfile(blob as Record<string, unknown>);
}

/**
 * Store the profile blob. `_userId` is accepted for a stable call shape;
 * the single-user Worker stores the one profile regardless. The blob
 * carries its own `updatedAt`, which the sync layer reconciles on.
 */
export async function pushRemoteProfile(
  _userId: string,
  profile: PlayerProfile,
): Promise<void> {
  if (!syncConfig) return;
  const res = await fetch(`${syncConfig.url}/profile`, {
    method: 'PUT',
    headers: {
      ...authHeaders(syncConfig.secret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(`sync push failed: ${res.status}`);
}

/**
 * Last-write-wins reconciliation: whichever profile has the newer
 * `updatedAt` wins as a whole. A tie keeps the local copy.
 */
export function reconcile(
  local: PlayerProfile,
  remote: PlayerProfile,
): PlayerProfile {
  return Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)
    ? remote
    : local;
}
