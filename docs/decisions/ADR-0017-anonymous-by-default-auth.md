# ADR-0017: Anonymous-by-default auth, upgrade at value moments

**Date:** 2026-05-20
**Status:** Superseded by [ADR-0020](ADR-0020-sync-off-supabase-cloudflare-worker.md) — auth removed (single-user). Originally extended [ADR-0013](ADR-0013-supabase-as-the-backend.md) and superseded the email+password signup-wall shipped under accounts plan §5.

## Context

The app is going hybrid — installable from the App Store and Google Play (Capacitor wrapper planned). The current auth flow is an email+password signup-wall in `AuthSheet`: a player who wants to save anything must type an email, choose a password, follow a confirmation link, then sign in.

For an installed mobile game that's the wrong threshold. Casual-game conversion data is unambiguous: a signup wall before first play loses most of the funnel. Modern installed apps default to *play first, account later*; the account is offered only at moments when it pays off (cross-device sync, subscribing, leaderboards, milestone protection). Single-device players never need an account at all.

The freemium-plus-subscription model ([ADR-0002](ADR-0002-freemium-plus-subscription.md)) does not actually require an app account — Apple/Google handle subscription billing, and "restore purchases" works without one. The account's real job is cross-device sync, cloud backup, and (later) social features.

App Store Review Guideline 4.8 also pins the provider set: if the app offers **any** third-party social login (Google, Facebook, etc.), it **must** also offer Sign In with Apple as an equivalent option on iOS. Anonymous-only and email-only do not trigger 4.8.

## Decision

Adopt **anonymous-by-default authentication, with account upgrade at value moments.**

- **Silent anonymous bootstrap.** On first launch, `AuthProvider` calls `supabase.auth.signInAnonymously()` when no session exists. The player has a real Supabase user ID from minute one; progress, stats and mastery save server-side immediately. No UI is surfaced.
- **No signup wall.** First launch goes straight to the board.
- **Upgrade prompts only at value moments.** Settings shows a "Save your progress" card to anonymous users. The same card is triggered from in-app moments where signup pays off (subscribe flow, cross-device sync request, streak / mastery milestones — added in follow-up work).
- **Provider set** at the upgrade moment:
  - **Apple Sign In** — required on iOS by guideline 4.8 once any social provider is offered.
  - **Google Sign In** — broad-reach social provider.
  - **Email magic link** (Supabase OTP) — passwordless fallback; does not trigger 4.8.
- The current **email + password** flow is retired from the UI. The existing user (Jonas) keeps his account; signing in with a magic link to the same email works without migration. The `signInWithPassword` method stays in `AuthProvider` for now as a quiet fallback but no UI calls it.
- **Account linking on upgrade.** When an anonymous user picks a provider, Supabase converts the anonymous user to a real one, preserving everything (`linkIdentity` flow). The player keeps their progress.

### Developer access (refines [ADR-0014](ADR-0014-developer-role-and-debug-panel.md))

The in-app debug panel is reached by any of three paths, in this order of precedence:

- **Dev build** (`import.meta.env.DEV === true`) — local `npm run dev` is always elevated; no 7-tap or sign-in needed during development. Production builds don't take this path.
- **7-tap version row** (ADR-0014) — works on any device, no sign-in needed.
- **Developer-allowlisted email** — auto-elevates on sign-in, as today.

A "View as guest" toggle in the dev menu overrides all three — the developer can preview the new-player experience without signing out and losing the elevated role. The toggle is persisted to `localStorage` so it survives a reload.

Consumers read this combined state through `useEffectiveDeveloper(isDeveloperFromProfile)` (in `src/lib/devViewContext.ts`), so the policy is one chokepoint instead of being repeated at every gate.

## Consequences

- **Enables:** zero-friction first launch (no signup wall); server-side state from day one without asking the player anything; the upgrade ask only lands at moments where it makes sense; the iOS guideline 4.8 box is checked the moment Google ships.
- **Costs:** four auth methods to maintain instead of one (anonymous, Apple, Google, magic link); the upgrade-from-anonymous flow has its own edge cases (link conflicts when an email is already used by a separate user); `AuthSheet` is rewritten end-to-end.
- **Capacitor caveat.** Capacitor isn't scaffolded yet. The web (Pages) build uses Supabase's `signInWithOAuth` redirect for Apple/Google — works today. When Capacitor lands, native plugins (`@capacitor-community/apple-sign-in`, `@codetrix-studio/capacitor-google-auth`) replace the redirect on iOS/Android for a nicer flow; the magic link path is unchanged.
- **Implies, for Jonas, out of band in the Supabase dashboard:**
  - Enable **Anonymous sign-ins** (Authentication → Providers → Anonymous).
  - Enable **Apple** provider with the Apple Service ID + secret (requires Apple Developer account, domain verification).
  - Enable **Google** provider with the Google OAuth client ID + secret (Google Cloud OAuth consent screen).
  - Email is built-in; just confirm SMTP is configured for magic-link delivery.
