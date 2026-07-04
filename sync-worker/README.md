# Tectonic profile-sync Worker

A tiny Cloudflare Worker + KV that stores Tectonic's single-user profile blob.
It replaces the Supabase `profiles` table (see [ADR-0020](../docs/decisions/ADR-0020-sync-off-supabase-cloudflare-worker.md)).

Tectonic is local-first and single-user (Jonas). The local profile is the
working copy; this Worker is the one place it is mirrored so it can follow the
user across devices (web on GitHub Pages, iOS via Capacitor).

## What it does

- `GET /profile` returns the stored JSON blob, or `404` when nothing is stored.
- `PUT /profile` stores the JSON request body as the profile.
- Both require `Authorization: Bearer <SYNC_SECRET>`; anything else gets `401`.
- CORS is allowed for the production Pages origin, the Capacitor iOS origins,
  and local dev (`https://tectonic.test`, the Vite dev server). `OPTIONS`
  preflight is handled.

One KV namespace (`PROFILES`), one key (`profile`).

## Deploy (Jonas runs these once)

From this directory (`sync-worker/`):

```bash
npm install

# 1. Create the KV namespace, then paste the returned id into wrangler.toml
#    (replacing REPLACE_WITH_KV_NAMESPACE_ID).
npx wrangler kv namespace create PROFILES

# 2. Set the bearer secret. Use a long random string; this same value goes
#    into the client's VITE_SYNC_SECRET (see the repo .env / deploy secrets).
npx wrangler secret put SYNC_SECRET

# 3. Deploy.
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL (for example
`https://tectonic-sync.<subdomain>.workers.dev`). That URL, with no trailing
slash, is the client's `VITE_SYNC_URL`. The client calls `${VITE_SYNC_URL}/profile`.

## Client wiring

Set these on the client side (never commit real values):

- `VITE_SYNC_URL`, the deployed Worker origin (no trailing slash).
- `VITE_SYNC_SECRET`, the same string passed to `wrangler secret put SYNC_SECRET`.

Locally they go in `.env.local`; in production they are the GitHub Actions
`vars.VITE_SYNC_URL` and `secrets.VITE_SYNC_SECRET` consumed by
`.github/workflows/deploy.yml`. When either is missing the app runs fully
local-only, exactly as it does with the vars unset today.

## Local development

```bash
npm run dev   # wrangler dev, with a local KV namespace
```

For a local `SYNC_SECRET`, put it in a `.dev.vars` file (gitignored):

```
SYNC_SECRET=some-local-dev-secret
```
