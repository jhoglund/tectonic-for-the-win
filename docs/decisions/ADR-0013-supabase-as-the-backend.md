# ADR-0013: Supabase as the backend platform

**Date:** 2026-05-16
**Status:** Superseded by [ADR-0020](ADR-0020-sync-off-supabase-cloudflare-worker.md) — originally amended [ADR-0011](ADR-0011-v1-scope-triage.md) and [ADR-0004](ADR-0004-tier-0-viral-before-backend.md)
**Source:** [docs/accounts-plan.md](../accounts-plan.md)

## Context

v1 was deliberately local-only: ADR-0011 cut the Auth and Account screens and committed to no backend; ADR-0004 deferred any server until Tier-0 viral mechanics had proven out. The cost is real — a local-only profile is lost on uninstall and cannot follow a player across devices. Jonas decided accounts are wanted now.

An earlier version of this ADR chose a **custom backend** — a hand-rolled Hono + Postgres/Drizzle service in its own `tectonic-api` repo. That was reversed before any code was written. A custom backend means a service to host, secure, pay for, and keep patched, plus hand-rolled email/password auth — security-critical surface to own. Jonas is cost- and ops-conscious during the dev phase and wanted to avoid both the hosting bill and owning auth.

## Decision

Use **Supabase** (managed Postgres + Auth + Row-Level Security) as the backend platform for **all backend database needs**, on the **free tier during the dev phase**. There is no custom API server and no `tectonic-api` repo — the app talks to Supabase directly via `@supabase/supabase-js`.

- **Auth:** Supabase Auth, email + password to start; "Sign in with Apple" is a fast-follow once Apple Developer enrolment lands.
- **Data:** a single `profiles` table — one row per user, the existing `PlayerProfile` blob stored whole in a `jsonb` column, keyed by the Supabase `auth.users` id.
- **Security boundary:** Postgres Row-Level Security — every row is readable/writable only by its owner (`auth.uid() = id`). The anon key ships in the client bundle; that is by design — it carries no privileges RLS doesn't grant.
- **Sync:** the profile stays **local-first**. The app is fully usable signed-out, exactly as today. Signing in reconciles the local and server profile, last-write-wins by `updatedAt`.

Build plan, data model, and schema: `docs/accounts-plan.md`.

## Consequences

- **Enables:** progress that survives uninstall and follows the player across devices and platforms; the data foundation Tier-1 social (ADR-0009) will also build on. One managed platform covers Postgres, auth, and future backend needs.
- **Costs:** the "no backend" simplicity is gone — there is now a hosted dependency. But there is no server to host, secure, or patch, and no auth code to own — Supabase manages all of it, and the free tier covers the dev phase. The privacy posture still changes (profile data leaves the device), so the App Store privacy labels and `docs/app-store-launch.md` need rework.
- **Implies:** ADR-0011's local-only stance and its cut of the Auth/Account screens are reversed; ADR-0004 still holds for *social* features (no leaderboard backend yet) but its "no backend at all" premise is amended. Soft-launch timing (backlog item 24) must now decide whether accounts ship *before* launch or whether launched local-only users are migrated *after* — see the plan. A vendor dependency on Supabase is accepted; the `jsonb`-blob data model keeps the schema portable if a migration is ever needed.
