import { defaultProfile, isPremium, type SolveRecord } from '../lib/profile';
import { useDevView } from '../lib/devViewContext';
import {
  STAGE_NAMES,
  TECHNIQUE_NAMES,
  MASTERY,
  SELF_TARGET,
  DEPTH,
  type PlayerStage,
  type MasteryState,
  type TechniqueMastery,
  type TechniqueName,
} from '../lib/progression';
import { useProfile } from '../lib/profileContext';
import { usePaywall } from '../lib/paywallContext';

const STAGES: PlayerStage[] = [0, 1, 2, 3, 4, 5];
const MASTERY_STATES: MasteryState[] = ['learning', 'familiar', 'mastered', 'legend'];

/** Counter fixtures that land every technique on the given chip state
 *  (the thresholds live in progression.ts). The `legend` state needs
 *  the depth-score's QUALITY and DIFFICULTY terms to be high — those
 *  read solve history, so `masteryAllHistory` returns a synthetic
 *  history alongside the counters. */
function masteryAll(
  state: MasteryState,
): Record<TechniqueName, TechniqueMastery> {
  const counts =
    state === 'legend'
      ? {
          usedCount: 40,
          selfAppliedCount: SELF_TARGET + 8,
          puzzlesContaining: DEPTH.legend.puzzles + 4,
        }
      : state === 'mastered'
        ? {
            usedCount: MASTERY.selfApplied,
            selfAppliedCount: MASTERY.selfApplied,
            puzzlesContaining: MASTERY.puzzles,
          }
        : state === 'familiar'
          ? {
              usedCount: MASTERY.familiarUsed,
              selfAppliedCount: 0,
              puzzlesContaining: 0,
            }
          : { usedCount: 0, selfAppliedCount: 0, puzzlesContaining: 0 };
  return Object.fromEntries(
    TECHNIQUE_NAMES.map((t) => [t, { technique: t, ...counts }]),
  ) as Record<TechniqueName, TechniqueMastery>;
}

/** A synthetic solve history that pegs the depth score's QUALITY and
 *  DIFFICULTY terms for every technique (no hints used, no errors,
 *  fast solves, all hard) — used by the `legend` mastery fixture. */
function legendSyntheticHistory(): SolveRecord[] {
  const now = new Date().toISOString();
  return TECHNIQUE_NAMES.flatMap((t) =>
    Array.from({ length: 10 }, () => ({
      date: now,
      difficulty: 'hard' as const,
      gridSize: '5x5' as const,
      timeMs: 60_000,
      hintsUsed: [],
      techniqueTally: [{ technique: t, used: 6, selfApplied: 6 }],
      isDailyPuzzle: false,
      errorsValidated: 0,
    })),
  );
}

const card: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--space-4)',
};

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="mb-1.5 text-[11px] font-semibold"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function DevBtn({
  label,
  onClick,
  active = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer px-2.5 py-1.5 text-[12px] font-medium"
      style={{
        borderRadius: 'var(--radius-button)',
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
        background: active ? 'var(--surface-active)' : 'var(--surface-elevated)',
        color: danger ? 'var(--danger)' : 'var(--text-primary)',
      }}
    >
      {label}
    </button>
  );
}

/**
 * Developer debug panel (backlog I5 / ADR-0014) — rendered in Settings
 * only when `profile.role === 'developer'`. Most "flows" are reached by
 * setting the profile into the state that routes to them: stage 0 shows
 * onboarding, a trailing `celebratedStage` shows the stage-up card, etc.
 */
export function DevTools() {
  const { profile, devSetProfile } = useProfile();
  const { viewAsGuest, setViewAsGuest } = useDevView();
  const { openPaywall } = usePaywall();
  const premium = isPremium(profile);

  return (
    <div className="flex flex-col gap-3.5" style={card}>
      <Group label="STAGE">
        {STAGES.map((s) => (
          <DevBtn
            key={s}
            label={`${s} · ${STAGE_NAMES[s]}`}
            active={profile.stage === s}
            onClick={() =>
              devSetProfile((p) => ({ ...p, stage: s, celebratedStage: s }))
            }
          />
        ))}
      </Group>

      <Group label="TECHNIQUE MASTERY — ALL TECHNIQUES">
        {MASTERY_STATES.map((m) => (
          <DevBtn
            key={m}
            label={m}
            onClick={() =>
              devSetProfile((p) => ({
                ...p,
                techniques: masteryAll(m),
                // Legend needs solve history for QUALITY + DIFFICULTY;
                // the other states stay where they were so this button
                // does not blow away the player's solve record.
                solveHistory:
                  m === 'legend' ? legendSyntheticHistory() : p.solveHistory,
              }))
            }
          />
        ))}
      </Group>

      <Group label="PREMIUM">
        <DevBtn
          label={premium ? 'Remove premium' : 'Grant premium (lifetime)'}
          onClick={() =>
            devSetProfile((p) =>
              premium
                ? { ...p, tier: 'free', premiumExpiresAt: undefined }
                : { ...p, tier: 'premium', premiumExpiresAt: undefined },
            )
          }
        />
      </Group>

      <Group label="JUMP TO FLOW / SCREEN">
        <DevBtn
          label="Onboarding"
          onClick={() =>
            devSetProfile((p) => ({
              ...p,
              stage: 0,
              celebratedStage: 0,
              tutorialsCompleted: 0,
            }))
          }
        />
        <DevBtn
          label="Stage-up card"
          onClick={() =>
            devSetProfile((p) => {
              const s = Math.max(1, p.stage) as PlayerStage;
              return { ...p, stage: s, celebratedStage: (s - 1) as PlayerStage };
            })
          }
        />
        <DevBtn label="Paywall" onClick={() => openPaywall('debug')} />
      </Group>

      <Group label="DEV VIEW">
        <DevBtn
          label={viewAsGuest ? 'Stop viewing as guest' : 'View as guest'}
          active={viewAsGuest}
          onClick={() => setViewAsGuest(!viewAsGuest)}
        />
      </Group>
      <p
        className="text-[11px]"
        style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}
      >
        Onboarding and the stage-up card render on the Home tab — switch to Home
        after setting them.
      </p>

      <Group label="RESET">
        <DevBtn
          label="Reset profile"
          danger
          onClick={() =>
            devSetProfile((p) => ({ ...defaultProfile(), role: p.role }))
          }
        />
        <DevBtn
          label="Turn off developer mode"
          danger
          onClick={() => devSetProfile((p) => ({ ...p, role: 'player' }))}
        />
      </Group>
    </div>
  );
}
