/**
 * Profile-sync configuration (ADR-0020).
 *
 * Sync is backed by a small Cloudflare Worker + KV (see `sync-worker/`),
 * not Supabase. It is env-driven and graceful: sync is enabled only when
 * both `VITE_SYNC_URL` and `VITE_SYNC_SECRET` are set. When either is
 * missing the app runs fully local-only, exactly as it did with the old
 * Supabase vars unset.
 *
 * The secret ships in the client bundle. That is acceptable here: Tectonic
 * is a single-user (Jonas) local-first app, so the bearer token guards one
 * profile blob, and the worst case is low stakes. See ADR-0020.
 */

const url = import.meta.env.VITE_SYNC_URL;
const secret = import.meta.env.VITE_SYNC_SECRET;

/** The sync Worker config, or `null` when sync is not configured. */
export const syncConfig: { url: string; secret: string } | null =
  url && secret ? { url, secret } : null;

/** True when the sync Worker is configured and profile sync can be used. */
export function isSyncEnabled(): boolean {
  return syncConfig !== null;
}
