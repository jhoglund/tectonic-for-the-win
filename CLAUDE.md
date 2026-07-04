# Project Instructions

## Spec-Driven Development

This project uses a layered spec approach. Before making changes, understand which layer you're working in.

| Layer | File | Purpose |
|-------|------|---------|
| **Product spec** | [`PRD.md`](PRD.md) | What players experience — guided difficulty journey, technique mastery, stats, monetization shape |
| **Architecture spec** | [`ARCHITECTURE.md`](ARCHITECTURE.md) | How it's built — engine, solver, hint chain, persistence, platform layers |
| **Progression spec** | [`specs/progression.md`](specs/progression.md) | The single source of truth for the difficulty curve, unlocks, technique mastery model, and stats. The differentiator. Read it before any change in that area. |
| **Solving techniques** | [`specs/solving-techniques.md`](specs/solving-techniques.md) | The catalogue of deductive techniques the hint engine uses, tiered cheap-to-last-resort. Read it before any change to `src/engine/hints.ts`. |
| **Design tokens** | [`specs/design-tokens.md`](specs/design-tokens.md) | Color, typography, spacing, motion — bound to CSS variables in `src/index.css` |
| **Design workflow** | [`specs/design-workflow.md`](specs/design-workflow.md) | How UX iteration flows between Claude Code and Open Design (`http://open-design.test`) |
| **Market & business** | [`docs/market-research.md`](docs/market-research.md) | Competitive landscape, monetization benchmarks, viral mechanics, launch phases. Constraints for product decisions. |

### Workflow for any change

1. Read the relevant spec before writing code.
2. Write code that respects the spec constraints (especially progression and design tokens).
3. Run `npm run lint` and `npm run build` — must pass.
4. If the change touches the player journey (difficulty gating, unlocks, mastery, stats), update `specs/progression.md` in the same PR.

### When adding new features

- Update `PRD.md` if it changes what the player experiences.
- Update `ARCHITECTURE.md` if it changes how the engine, persistence, or platform is structured.
- Write an ADR if the decision will outlive the current PR.

---

## Project Tracking

Solo project, file-based. Three places to look or write.

| Where | What goes there |
|-------|------------------|
| [`docs/decisions/`](docs/decisions/) | ADRs — decisions with consequences beyond a single PR. MADR-lite format; see [`docs/decisions/README.md`](docs/decisions/README.md). |
| [`docs/backlog.md`](docs/backlog.md) | Single tracker — Now (active), Next (committed), Later (intent), Open questions. The App Store launch plan lives here. |
| [`docs/handovers/`](docs/handovers/) | End-of-session handover notes for picking up multi-session work. |

### Conventions

- **Before making a non-trivial decision** that will outlive the current PR, write an ADR. Reference the source spec; don't restate it.
- **When starting work** on something not yet in the backlog, add it to the right section. When finishing, remove it.
- **Open questions** stay in `docs/backlog.md` until resolved — at which point they either become ADRs or get closed by inline answers in the relevant spec.
- **GitHub Issues are not used yet.** When a collaborator joins, items in Now/Next migrate to issues; ADRs and the open-questions list stay where they are.

### Routine implementation choices

Don't write an ADR for routine implementation decisions — they belong in commit messages or PR descriptions. ADRs are for things future-Jonas needs to find by topic.

---

## Design System

Token-based. All visual values are defined as CSS custom properties in `src/index.css` and documented in [`specs/design-tokens.md`](specs/design-tokens.md).

Before writing or modifying any UI code:

1. Read [`specs/design-tokens.md`](specs/design-tokens.md).
2. Use only design tokens — no hardcoded hex colors, no arbitrary pixel sizes.
3. Use semantic tokens over palette tokens (`text-primary` not `text-gray-900`, `cell-assumption` not `bg-amber-400`).
4. When CSS vars can't be used (SVG props, chart libraries), import from a centralized JS constants module — never duplicate values inline.
5. New tokens must be added to both `src/index.css` (light + dark mode) and `specs/design-tokens.md`.

---

## Tech Stack

- **Vite 8** + **React 19** + **TypeScript 5.9**
- **Tailwind CSS 4** (CSS-driven config, no `tailwind.config.js`)
- Hand-rolled puzzle engine in `src/engine/` — generator, solver, hint chain, URL codec
- Web Worker for puzzle generation (`generator.worker.ts`)
- Local-first state (share via URL hash); single-user profile sync via a
  Cloudflare Worker + KV, env-gated and optional (ADR-0020, `sync-worker/`)
- **Open Design** at `http://open-design.test` for UX iteration (see `specs/design-workflow.md`)
- **Capacitor** planned for iOS wrapper (not yet scaffolded; ADR pending)

---

## Conventions

- Mobile-first responsive design
- Dark mode via `prefers-color-scheme` + CSS custom properties
- Engine is pure TypeScript — no React imports, no DOM dependencies
- React layer only reads engine output; it never re-implements engine logic
- Hint chain steps are produced by `src/engine/hints.ts` and rendered by `Cell.tsx` overlays — never compute chain semantics in the component layer
- Shareable URL = full game state encoded as base64url hash (`src/engine/urlCodec.ts`)

---

## When in doubt

Read [`docs/market-research.md`](docs/market-research.md) and [`specs/progression.md`](specs/progression.md). Those two documents tell you what game we're building and why we expect it to win.
