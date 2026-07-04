import type { Difficulty, GridSize } from '../engine/types';
import {
  type TechniqueName,
  type TechniqueMastery,
  type PlayerStage,
  TECHNIQUE_NAMES,
  TUTORIALS_TO_BEGINNER,
  emptyMastery,
  nextStageFor,
} from './progression';
import { verifyVoucher } from './vouchers';
import { migrateProfile } from './profile-migrations';

/**
 * The player profile — local-only persistence for the difficulty
 * journey. Schema mirrors specs/progression.md §8. Pure functions
 * (defaultProfile, recordSolve, recordTutorialCompletion) plus the
 * localStorage load/save pair.
 */

const STORAGE_KEY = 'tectonic.profile';
const SOLVE_HISTORY_CAP = 1000;

/** A pristine profile carries the epoch as `updatedAt` so any profile
 *  with real progress wins last-write-wins reconciliation against it. */
const EPOCH = new Date(0).toISOString();

/** One completed solve, as stored in the profile's history. */
export interface SolveRecord {
  date: string; // ISO timestamp
  difficulty: Difficulty;
  gridSize: GridSize;
  timeMs: number;
  /** Hint-only summary, kept for the Stats aggregation. */
  hintsUsed: { technique: TechniqueName; count: number }[];
  /** Per-technique tally — used vs self-applied — needed by the depth
   *  score's QUALITY term (ADR-0018). Optional, since v1-migrated
   *  records don't carry it; depth falls back to hintsUsed in that
   *  case. */
  techniqueTally?: { technique: TechniqueName; used: number; selfApplied: number }[];
  isDailyPuzzle: boolean;
  /** Distinct cells the player tapped Validate on while wrong
   *  (ADR-0018, schema v2). Feeds the QUALITY term of the depth score. */
  errorsValidated: number;
  /** Benchmark solve time for this puzzle's difficulty × grid size,
   *  for QUALITY's time term. Omitted when not pre-seeded; the depth
   *  score falls back to a static table lookup. */
  parTimeMs?: number;
}

export interface PlayerProfile {
  stage: PlayerStage;
  /** Highest stage whose celebration card has been shown — when it
   *  trails `stage`, a stage-up card is pending (progression.md §5). */
  celebratedStage: PlayerStage;
  techniques: Record<TechniqueName, TechniqueMastery>;
  /** Newcomer tutorial rung within stage 5. 0 = pre-Legend; 1–4 =
   *  Apprentice → Adept → Grand → Mythic Legend (ADR-0019). */
  legendRung: 0 | 1 | 2 | 3 | 4;
  /** Newcomer tutorial puzzles completed (gates stage 0 → 1). */
  tutorialsCompleted: number;
  solveHistory: SolveRecord[];
  streak: { current: number; longest: number; lastSolveDate: string };
  tier: 'free' | 'premium';
  premiumExpiresAt?: string;
  /** Voucher codes redeemed on this device — blocks per-device reuse. */
  redeemedVouchers: string[];
  settings: { theme: string; sound: boolean; haptics: boolean };
  /** Access role — `developer` unlocks the in-app debug panel (ADR-0014). */
  role: 'player' | 'developer';
  /** ISO timestamp of the last meaningful change. Drives last-write-wins
   *  account sync (ADR-0013); a pristine profile carries the epoch. */
  updatedAt: string;
  schemaVersion: 2;
}

/** Per-technique tally a finished solve reports to recordSolve(). */
export interface SolveTechniqueTally {
  technique: TechniqueName;
  /** Times the technique fired this solve (assisted + self-applied). */
  used: number;
  /** Of those, how many the player made before a hint was offered. */
  selfApplied: number;
}

/** Everything a finished solve hands to recordSolve(). */
export interface SolveOutcome {
  difficulty: Difficulty;
  gridSize: GridSize;
  timeMs: number;
  isDailyPuzzle: boolean;
  /** ISO timestamp; defaults to now. */
  date?: string;
  techniques: SolveTechniqueTally[];
  /** Distinct cells the player tapped Validate on while wrong
   *  (ADR-0018). Optional — caller defaults to 0 when not tracked. */
  errorsValidated?: number;
}

function freshTechniques(): Record<TechniqueName, TechniqueMastery> {
  return Object.fromEntries(
    TECHNIQUE_NAMES.map((t) => [t, emptyMastery(t)]),
  ) as Record<TechniqueName, TechniqueMastery>;
}

/** A new player's profile — Newcomer stage, everything zeroed. */
export function defaultProfile(): PlayerProfile {
  return {
    stage: 0,
    celebratedStage: 0,
    techniques: freshTechniques(),
    legendRung: 0,
    tutorialsCompleted: 0,
    solveHistory: [],
    streak: { current: 0, longest: 0, lastSolveDate: '' },
    tier: 'free',
    redeemedVouchers: [],
    settings: { theme: 'system', sound: true, haptics: true },
    role: 'player',
    updatedAt: EPOCH,
    schemaVersion: 2,
  };
}

/** YYYY-MM-DD day key for an ISO timestamp. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Whole-day difference between two YYYY-MM-DD keys (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Ingest a finished solve. Pure — returns a new profile plus the stage
 * the player advanced into, if any (for the stage-up celebration).
 */
export function recordSolve(
  profile: PlayerProfile,
  outcome: SolveOutcome,
): { profile: PlayerProfile; stageUp: PlayerStage | null } {
  const date = outcome.date ?? new Date().toISOString();

  // --- technique counters ---
  const techniques: Record<TechniqueName, TechniqueMastery> = {
    ...profile.techniques,
  };
  for (const tally of outcome.techniques) {
    const prev = techniques[tally.technique];
    techniques[tally.technique] = {
      technique: tally.technique,
      usedCount: prev.usedCount + tally.used,
      selfAppliedCount: prev.selfAppliedCount + tally.selfApplied,
      puzzlesContaining:
        prev.puzzlesContaining + (tally.selfApplied > 0 ? 1 : 0),
    };
  }

  // --- solve history (capped) ---
  const hintsUsed = outcome.techniques
    .map((t) => ({ technique: t.technique, count: t.used - t.selfApplied }))
    .filter((h) => h.count > 0);
  const techniqueTally = outcome.techniques
    .filter((t) => t.used > 0 || t.selfApplied > 0)
    .map((t) => ({
      technique: t.technique,
      used: t.used,
      selfApplied: t.selfApplied,
    }));
  const record: SolveRecord = {
    date,
    difficulty: outcome.difficulty,
    gridSize: outcome.gridSize,
    timeMs: outcome.timeMs,
    hintsUsed,
    techniqueTally,
    isDailyPuzzle: outcome.isDailyPuzzle,
    errorsValidated: outcome.errorsValidated ?? 0,
  };
  const solveHistory = [...profile.solveHistory, record].slice(
    -SOLVE_HISTORY_CAP,
  );

  // --- streak ---
  const today = dayOf(date);
  let { current, longest } = profile.streak;
  const last = profile.streak.lastSolveDate;
  if (last === '') {
    current = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap === 0) {
      // already solved today — streak unchanged
    } else if (gap === 1) {
      current += 1;
    } else {
      current = 1; // a missed day (or a backdated solve) restarts the run
    }
  }
  longest = Math.max(longest, current);
  const streak = { current, longest, lastSolveDate: today };

  // --- stage advancement (loop to allow a multi-stage jump) ---
  let stage = profile.stage;
  const hardSolveCount = solveHistory.filter(
    (s) => s.difficulty === 'hard',
  ).length;
  for (;;) {
    const next = nextStageFor({
      stage,
      techniques,
      tutorialsCompleted: profile.tutorialsCompleted,
      hardSolveCount,
      history: solveHistory,
    });
    if (next === null) break;
    stage = next;
  }

  const updated: PlayerProfile = {
    ...profile,
    stage,
    techniques,
    solveHistory,
    streak,
    updatedAt: date,
  };
  return { profile: updated, stageUp: stage !== profile.stage ? stage : null };
}

/**
 * Record one completed Newcomer tutorial puzzle. Pure — returns the new
 * profile plus the stage advanced into (Beginner, after the third).
 */
export function recordTutorialCompletion(
  profile: PlayerProfile,
): { profile: PlayerProfile; stageUp: PlayerStage | null } {
  const tutorialsCompleted = profile.tutorialsCompleted + 1;
  let stage = profile.stage;
  for (;;) {
    const next = nextStageFor({
      stage,
      techniques: profile.techniques,
      tutorialsCompleted,
      hardSolveCount: profile.solveHistory.filter(
        (s) => s.difficulty === 'hard',
      ).length,
      history: profile.solveHistory,
    });
    if (next === null) break;
    stage = next;
  }
  const updated: PlayerProfile = {
    ...profile,
    tutorialsCompleted,
    stage,
    updatedAt: new Date().toISOString(),
  };
  return { profile: updated, stageUp: stage !== profile.stage ? stage : null };
}

/**
 * Fill any missing fields of a parsed profile from the defaults. Also
 * used to sanitise a profile blob pulled from the account backend.
 */
export function normalizeProfile(
  parsed: Record<string, unknown>,
): PlayerProfile {
  const base = defaultProfile();
  const techniques = freshTechniques();
  const storedTechniques = parsed.techniques as
    | Partial<Record<TechniqueName, TechniqueMastery>>
    | undefined;
  if (storedTechniques) {
    for (const t of TECHNIQUE_NAMES) {
      const stored = storedTechniques[t];
      if (stored) techniques[t] = { ...techniques[t], ...stored };
    }
  }
  return {
    ...base,
    ...(parsed as Partial<PlayerProfile>),
    techniques,
    // A profile saved before this field existed has already passed its
    // stage-up moments — assume celebrated up to its current stage so
    // old cards do not fire retroactively.
    celebratedStage:
      (parsed.celebratedStage as PlayerStage | undefined) ??
      (parsed.stage as PlayerStage | undefined) ??
      0,
    redeemedVouchers: Array.isArray(parsed.redeemedVouchers)
      ? (parsed.redeemedVouchers as string[])
      : [],
    streak: { ...base.streak, ...(parsed.streak as object) },
    settings: { ...base.settings, ...(parsed.settings as object) },
    // A profile saved before this field existed is a returning player's
    // current state — treat it as freshly updated so it is not lost to a
    // last-write-wins comparison on first sign-in.
    updatedAt:
      typeof parsed.updatedAt === 'string'
        ? parsed.updatedAt
        : new Date().toISOString(),
    role: parsed.role === 'developer' ? 'developer' : 'player',
    legendRung:
      ((parsed.legendRung as 0 | 1 | 2 | 3 | 4 | undefined) ?? 0),
    schemaVersion: 2,
  };
}

/**
 * Whether the profile currently has premium access — `tier` is the raw
 * stored value, but a timed grant (`premiumExpiresAt`) can have lapsed,
 * so this is the source of truth for entitlement checks.
 */
export function isPremium(profile: PlayerProfile): boolean {
  if (profile.tier !== 'premium') return false;
  if (!profile.premiumExpiresAt) return true; // lifetime grant
  return Date.parse(profile.premiumExpiresAt) > Date.now();
}

/** Whether the profile holds the developer role — unlocks the in-app
 *  debug panel (ADR-0014). */
export function isDeveloper(profile: PlayerProfile): boolean {
  return profile.role === 'developer';
}

/**
 * Emails granted the developer role automatically (ADR-0014). This was
 * the account-backed elevation path under Supabase auth. Since ADR-0020
 * removed auth (the local user has no email), this path is inert and the
 * in-app 7-tap Version unlock is the live way to elevate. Kept for the
 * `withDeveloperRole` call shape and in case an email identity returns.
 */
export const DEVELOPER_EMAILS: readonly string[] = ['jonas@stixy.com'];

/** Whether an email is on the developer allowlist (case-insensitive). */
export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Elevate a profile to the developer role when the signed-in email is on
 * the allowlist. Never downgrades — a developer (allowlisted, or unlocked
 * by the 7-tap gesture) stays a developer. Returns the profile unchanged
 * when no elevation applies, so callers can identity-compare the result.
 */
export function withDeveloperRole(
  profile: PlayerProfile,
  email: string | null | undefined,
): PlayerProfile {
  if (profile.role === 'developer' || !isDeveloperEmail(email)) {
    return profile;
  }
  return {
    ...profile,
    role: 'developer',
    updatedAt: new Date().toISOString(),
  };
}

/** Outcome of a voucher redemption. */
export type RedeemResult =
  | { ok: true; profile: PlayerProfile; days: number }
  | { ok: false; reason: 'invalid' | 'already-redeemed' };

/**
 * Redeem a voucher code (backlog item 17a). Pure — verifies the code,
 * grants premium (lifetime or timed; a timed grant extends an existing
 * one and never downgrades a lifetime), and records the code so it
 * cannot be reused on this device.
 */
export function redeemVoucher(
  profile: PlayerProfile,
  code: string,
): RedeemResult {
  const normalized = code.trim().toUpperCase();
  const grant = verifyVoucher(normalized);
  if (!grant) return { ok: false, reason: 'invalid' };
  if (profile.redeemedVouchers.includes(normalized)) {
    return { ok: false, reason: 'already-redeemed' };
  }

  const alreadyLifetime =
    profile.tier === 'premium' && !profile.premiumExpiresAt;
  let premiumExpiresAt: string | undefined;
  if (grant.days === 0 || alreadyLifetime) {
    // Lifetime grant, or a timed grant on top of lifetime — stay lifetime.
    premiumExpiresAt = undefined;
  } else {
    // Timed grant — extend from the later of now or the current expiry.
    const from =
      profile.tier === 'premium' && profile.premiumExpiresAt
        ? Math.max(Date.now(), Date.parse(profile.premiumExpiresAt))
        : Date.now();
    premiumExpiresAt = new Date(
      from + grant.days * 86_400_000,
    ).toISOString();
  }

  return {
    ok: true,
    days: grant.days,
    profile: {
      ...profile,
      tier: 'premium',
      premiumExpiresAt,
      redeemedVouchers: [...profile.redeemedVouchers, normalized],
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mark the player's current stage as celebrated — dismisses the
 * stage-up card so it never repeats (progression.md §5).
 */
export function markStageCelebrated(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    celebratedStage: profile.stage,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Skip the Newcomer tutorials — count them all complete and advance to
 * Beginner. The resulting stage is marked celebrated too: a player who
 * opted out of onboarding should not be handed its stage-up card.
 */
export function skipTutorials(profile: PlayerProfile): PlayerProfile {
  const tutorialsCompleted = Math.max(
    profile.tutorialsCompleted,
    TUTORIALS_TO_BEGINNER,
  );
  const hardSolveCount = profile.solveHistory.filter(
    (s) => s.difficulty === 'hard',
  ).length;
  let stage = profile.stage;
  for (;;) {
    const next = nextStageFor({
      stage,
      techniques: profile.techniques,
      tutorialsCompleted,
      hardSolveCount,
    });
    if (next === null) break;
    stage = next;
  }
  return {
    ...profile,
    tutorialsCompleted,
    stage,
    celebratedStage: stage,
    updatedAt: new Date().toISOString(),
  };
}

/** Load the profile from localStorage, or a fresh one if absent/invalid. */
export function loadProfile(): PlayerProfile {
  if (typeof localStorage === 'undefined') return defaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed) return defaultProfile();
    // Run any pending schema migration before normalising.
    const migrated = migrateProfile(parsed);
    if (!migrated) return defaultProfile();
    return normalizeProfile(migrated);
  } catch {
    return defaultProfile();
  }
}

/** Persist the profile. Silently no-ops if storage is unavailable. */
export function saveProfile(profile: PlayerProfile): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // quota exceeded or storage disabled — nothing actionable here.
  }
}
