# Backend sync: current state and pickup guide

> Read this first when resuming Tectonic and you need to remember how the backend
> works. It records the **live/operational** state after the Supabase -> Cloudflare
> Worker migration shipped (2026-07-04). The **decision** behind it is
> [ADR-0020](decisions/ADR-0020-sync-off-supabase-cloudflare-worker.md); the Worker's
> own build/deploy detail is [`sync-worker/README.md`](../sync-worker/README.md).
> This doc ties those together and does not duplicate them.

**Last updated:** 2026-07-04

## TL;DR

- Tectonic is local-first and single-user. Profile sync mirrors one profile blob so
  it follows the one user across web and iOS.
- The sync backend is a **Cloudflare Worker + KV**. **Supabase is fully gone** (Auth,
  the `profiles` table, and the project itself, deleted 2026-07-04). The migration is
  **one-way**, there is nothing to fall back to.
- Auth is **stubbed to one fixed local user**. There is no sign-in.
- When `VITE_SYNC_URL` / `VITE_SYNC_SECRET` are unset the app runs **local-only,
  gracefully** (`isSyncEnabled()` is false). Nothing breaks without the backend.

## What is running

| Piece | Value |
|-------|-------|
| Worker name | `tectonic-sync` |
| Worker URL | `https://tectonic-sync.jhoglund.workers.dev` |
| Worker source | [`sync-worker/`](../sync-worker/) (routes `GET` / `PUT /profile`, bearer auth, CORS) |
| Cloudflare account | `jonas@stixy.com` (id `65eb79bd36257fe1453480202d7f05d2`) |
| KV binding | `PROFILES` |
| KV namespace id | `357880cb70674e30b741fedfa3afb9c0` (committed in [`sync-worker/wrangler.toml`](../sync-worker/wrangler.toml)) |
| KV keys | one key, `profile` (single user) |
| Worker secret | `SYNC_SECRET` (set via `wrangler secret put`, never committed) |

### Client wiring

- The client reads `VITE_SYNC_URL` (the Worker origin, no trailing slash) and
  `VITE_SYNC_SECRET` (must match the Worker's `SYNC_SECRET`). It calls
  `${VITE_SYNC_URL}/profile`.
- **Local:** both live in `.env.local` (gitignored; a backup sits at `.env.local.bak`).
- **Prod (GitHub Pages):** `vars.VITE_SYNC_URL` + `secrets.VITE_SYNC_SECRET` in GitHub
  Actions, consumed by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
  The old `VITE_SUPABASE_*` CI entries were deleted.

### Auth (stubbed)

`AuthProvider.tsx` reports one constant, always-signed-in user (`id: 'local'`). Supabase
Auth, OAuth, magic-link, and the `AuthSheet` UI were all removed. The `useAuth` /
`authContext` shape is unchanged, so `ProfileProvider` and the Settings / DevTools
consumers still compile untouched.

Consequence: the developer-email elevation path (ADR-0014) is now inert (the local user
has no email). The **7-tap Version unlock** is the live way to elevate.

## Shipped

- **iOS build 7** uploaded to TestFlight, verified working and syncing on Jonas's phone.
- **Web** deploys to GitHub Pages on push to `main`.

## Runbook (resuming dev)

Run Worker / KV commands from `sync-worker/`.

**Local dev**

```bash
npm run dev
```

Sync is active because `.env.local` carries `VITE_SYNC_URL` / `VITE_SYNC_SECRET`. Remove
or blank them and the app runs local-only (graceful).

**Change / redeploy the Worker**

```bash
cd sync-worker && npx wrangler deploy
```

**Inspect / edit the stored profile**

```bash
npx wrangler kv key get --namespace-id 357880cb70674e30b741fedfa3afb9c0 profile --remote
# kv key put / kv key delete take the same --namespace-id + key form
```

**Rotate the bearer secret**

```bash
npx wrangler secret put SYNC_SECRET
```

Then update `VITE_SYNC_SECRET` in **both** `.env.local` **and** the GitHub Actions secret
so client and Worker match. A mismatch shows up as `401` from the Worker.

**Ship a new iOS build**

1. Bump `CURRENT_PROJECT_VERSION` (two spots in
   [`ios/App/App.xcodeproj/project.pbxproj`](../ios/App/App.xcodeproj/project.pbxproj)).
2. `npm run sync:ios`.
3. Archive the **`.xcodeproj`** (not a workspace, the project is SPM-based), export with
   [`ios/ExportOptions.plist`](../ios/ExportOptions.plist), then re-export with
   `destination=upload`. The upload uses the cached Xcode account, so no App Store
   Connect issuer id is needed.
4. Gotcha: an upload can fail `CONTRACT_NOT_VALID` if an App Store Connect agreement needs
   re-accepting (App Store Connect -> Business).

## If Tectonic ever goes multi-user

The stubbed single-user identity and the single-bearer-secret model must be revisited:
real auth and per-user isolation have to come back, and ADR-0020 would then be superseded
in turn. See [ADR-0020](decisions/ADR-0020-sync-off-supabase-cloudflare-worker.md) for the
trade that was accepted here (a bundle-inspectable bearer secret, acceptable only while
single-user).

## See also

- [ADR-0020](decisions/ADR-0020-sync-off-supabase-cloudflare-worker.md) - the decision and
  its consequences.
- [`sync-worker/README.md`](../sync-worker/README.md) - the Worker's routes, deploy steps,
  and client wiring in full.
