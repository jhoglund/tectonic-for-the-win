# ADR-0020: Move profile sync off Supabase to a Cloudflare Worker + KV

**Date:** 2026-07-04
**Status:** Accepted, supersedes [ADR-0013](ADR-0013-supabase-as-the-backend.md) and [ADR-0017](ADR-0017-anonymous-by-default-auth.md)

## Context

ADR-0013 adopted Supabase (managed Postgres + Auth + RLS) as the backend, and
ADR-0017 layered anonymous-by-default auth (Apple / Google / magic link) on top.
In practice Tectonic only ever used Supabase for **one thing**: syncing a single
player's profile blob. There is one real user (Jonas), one `profiles` row, one
`jsonb data` column. The whole Auth apparatus existed only to name that one user
for sync.

That is a lot of surface for one blob. The Supabase project also carries a
~$9.50/mo compute line that no longer earns its keep during the dev phase, and
the "anonymous bootstrap, then upgrade at a value moment" flow (four auth methods,
OAuth redirects, a native deep-link callback) is complexity with no active
beneficiary while the app is single-user.

## Decision

Replace Supabase (Auth **and** the `profiles` table) with a small **Cloudflare
Worker + KV**, and **stub identity to one fixed local user**.

- **Sync backend:** a Worker in `sync-worker/` with `GET /profile` and
  `PUT /profile`, backed by a single KV namespace (`PROFILES`) and one key
  (`profile`). It stores the same `PlayerProfile` blob, whole, exactly as the
  `jsonb` column did. Access is a single bearer secret
  (`Authorization: Bearer <SYNC_SECRET>`).
- **Identity:** no real auth. `AuthProvider` reports one constant,
  always-signed-in user (`id: 'local'`). The `useAuth` / `authContext` shape is
  unchanged so `ProfileProvider` and the Settings / DevTools consumers compile
  untouched, but the Supabase / OAuth / magic-link / anonymous logic is gone, and
  the sign-in UI (`AuthSheet`, the Settings account section) is removed.
- **Client sync:** `profileSync.ts` calls the Worker with `fetch()` instead of the
  Supabase client. `reconcile()` (last-write-wins by `updatedAt`) and the
  `SyncState` type are unchanged. Sync stays env-gated and graceful:
  `VITE_SYNC_URL` + `VITE_SYNC_SECRET` replace `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY`; when either is missing the app runs fully local-only,
  exactly as before.
- **Bundle-inspectable secret:** the bearer secret ships in the client bundle.
  Accepted: single user, low stakes, the token guards one profile blob. This is a
  deliberate trade for a sync mechanism with near-zero cost and ops.

## Consequences

- **Enables:** eliminates the Supabase compute line; removes an entire auth
  codebase (OAuth, magic link, anonymous bootstrap, the native
  `tectonic://auth/callback` deep-link handler in `AppDelegate` + the URL scheme
  in `Info.plist`, all now removed); keeps cross-device profile sync working with a
  Worker + KV that costs effectively nothing at this scale.
- **Costs / limits:** the security model is a shared bearer secret, not per-user
  RLS. This is only acceptable **because** the app is single-user. If Tectonic ever
  becomes multi-user, real auth and per-user isolation must come back (this ADR
  would then be superseded in turn). The developer-allowlist-by-email elevation
  path (ADR-0014) is now inert since the local user has no email; the 7-tap Version
  unlock remains the live way to elevate.
- **Obsoletes:** `supabase/schema.sql` (removed), the `@supabase/supabase-js`
  dependency (removed), and the ADR-0017 provider set. ADR-0013's "Supabase as the
  backend platform for all backend database needs" is narrowed to nothing:
  there is currently no database backend, only a KV blob store for one profile.
- **Out of band, for Jonas:** create the KV namespace, set the Worker secret,
  deploy the Worker, update `.env.local` and the deploy vars/secret, then delete the
  now-unused Supabase project. Steps are in `sync-worker/README.md`.
