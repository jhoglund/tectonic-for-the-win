/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { HomeLanding } from './screens/HomeLanding';
import { SolvingScreen } from './screens/SolvingScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SolvedScreen } from './screens/SolvedScreen';
import { UnresolvedPuzzlesScreen } from './screens/UnresolvedPuzzlesScreen';
import { TabBar, type Tab } from './components/TabBar';
import { Board, type CellOverlay } from './components/Board';
import { Keypad } from './components/Keypad';
import { Paywall } from './components/Paywall';
import { DifficultyPicker } from './components/DifficultyPicker';
import { AbandonAlert } from './components/AbandonAlert';
import { ClearPuzzleAlert } from './components/ClearPuzzleAlert';
import { StageUpCard } from './components/StageUpCard';
import { ProfileContext } from './lib/profileContext';
import { AuthContext, type AuthContextValue } from './lib/authContext';
import { PaywallContext } from './lib/paywallContext';
import { DevViewContext } from './lib/devViewContext';
import { defaultProfile, type PlayerProfile } from './lib/profile';
import { TECHNIQUE_NAMES } from './lib/progression';
import { generatePuzzle } from './engine/generator';
import { createGameState } from './lib/gameState';
import { encodeState } from './engine/urlCodec';
import { findHint, type Hint, type HintNotes } from './engine/hints';
import { posKey } from './engine/types';
import type { GameState, GridSize, Difficulty } from './engine/types';
import type { UnresolvedPuzzle } from './lib/unresolvedPuzzles';
import { NEWCOMER_TUTORIALS } from './data/tutorials';

const now = new Date('2026-05-25T12:49:00.000Z').toISOString();

const captureStyles = document.createElement('style');
captureStyles.textContent = `
  body {
    margin: 0;
    background: #eef3f6;
    font-family: var(--font-ui);
  }

  .capture-page {
    min-height: 100vh;
    padding: 40px;
  }

  .capture-header {
    max-width: 1280px;
    margin: 0 auto var(--space-8);
  }

  .capture-header h1 {
    margin: 0;
    font-size: 32px;
    line-height: 36px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .capture-header p {
    margin: var(--space-2) 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-secondary);
  }

  .capture-grid {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 390px);
    gap: 40px;
    align-items: start;
  }

  .capture-section {
    grid-column: 1 / -1;
    margin: var(--space-6) 0 0;
    font-size: 13px;
    line-height: 18px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    border-top: 1px solid rgba(17, 24, 39, 0.12);
    padding-top: var(--space-4);
  }

  .capture-card h2 {
    margin: 0 0 var(--space-2);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .exact-phone {
    position: relative;
    width: 390px;
    height: 844px;
    overflow: hidden;
    background: var(--surface);
    border-radius: 36px;
    box-shadow: 0 24px 70px rgba(17, 24, 39, 0.15);
    transform: translateZ(0);
  }

  .phone-main {
    height: 100%;
    overflow: hidden;
  }

  .exact-phone .min-h-screen {
    min-height: 844px;
  }

  .bottom-nav-shell {
    position: absolute;
  }
`;
document.head.appendChild(captureStyles);

function screenProfile(): PlayerProfile {
  const profile = defaultProfile();
  profile.stage = 1;
  profile.celebratedStage = 1;
  profile.tutorialsCompleted = 3;
  profile.streak = { current: 3, longest: 7, lastSolveDate: '2026-05-25' };
  profile.solveHistory = [
    {
      date: '2026-05-23T11:00:00.000Z',
      difficulty: 'easy',
      gridSize: '5x5',
      timeMs: 142_000,
      hintsUsed: [],
      techniqueTally: [{ technique: 'naked-single', used: 4, selfApplied: 4 }],
      isDailyPuzzle: false,
      errorsValidated: 0,
    },
    {
      date: '2026-05-24T11:00:00.000Z',
      difficulty: 'medium',
      gridSize: '5x5',
      timeMs: 312_000,
      hintsUsed: [{ technique: 'hidden-single', count: 1 }],
      techniqueTally: [{ technique: 'hidden-single', used: 3, selfApplied: 2 }],
      isDailyPuzzle: false,
      errorsValidated: 1,
    },
    {
      date: '2026-05-25T11:00:00.000Z',
      difficulty: 'easy',
      gridSize: '5x5',
      timeMs: 138_000,
      hintsUsed: [],
      techniqueTally: [{ technique: 'naked-single', used: 5, selfApplied: 5 }],
      isDailyPuzzle: true,
      errorsValidated: 0,
    },
    {
      date: '2026-05-25T12:00:00.000Z',
      difficulty: 'hard',
      gridSize: '5x5',
      timeMs: 520_000,
      hintsUsed: [{ technique: 'forced-move', count: 2 }],
      techniqueTally: [{ technique: 'forced-move', used: 4, selfApplied: 2 }],
      isDailyPuzzle: false,
      errorsValidated: 1,
    },
    {
      date: '2026-05-25T12:30:00.000Z',
      difficulty: 'easy',
      gridSize: '5x5',
      timeMs: 118_000,
      hintsUsed: [],
      techniqueTally: [{ technique: 'naked-single', used: 5, selfApplied: 5 }],
      isDailyPuzzle: false,
      errorsValidated: 0,
    },
  ];
  for (const technique of TECHNIQUE_NAMES) {
    profile.techniques[technique] = {
      technique,
      usedCount: technique === 'naked-single' ? 9 : technique === 'hidden-single' ? 3 : 1,
      selfAppliedCount: technique === 'naked-single' ? 6 : technique === 'hidden-single' ? 2 : 0,
      puzzlesContaining: technique === 'naked-single' ? 2 : technique === 'hidden-single' ? 1 : 0,
    };
  }
  profile.role = 'player';
  profile.updatedAt = now;
  return profile;
}

const profile = screenProfile();

function puzzleState(seed: number, difficulty: Difficulty = 'easy', gridSize: GridSize = '5x5'): GameState {
  const size = gridSize === '8x8' ? 8 : 5;
  return createGameState(generatePuzzle(size, size, difficulty, seed));
}

function unresolved(seed: number, id: string, difficulty: Difficulty, gridSize: GridSize, elapsedSeconds: number): UnresolvedPuzzle {
  const gameState = puzzleState(seed, difficulty, gridSize);
  const grid = gameState.grid.map((row) => [...row]);
  const fillCount = gridSize === '8x8' ? 8 : 4;
  let filled = 0;
  for (let row = 0; row < grid.length && filled < fillCount; row += 1) {
    for (let col = 0; col < grid[row].length && filled < fillCount; col += 1) {
      if (grid[row][col] === 0) {
        grid[row][col] = gameState.puzzle.solution[row][col];
        filled += 1;
      }
    }
  }
  return {
    id,
    encodedState: encodeState(gameState.puzzle, grid, difficulty),
    difficulty,
    gridSize,
    isDailyPuzzle: id.startsWith('daily'),
    createdAt: now,
    updatedAt: new Date(Date.parse(now) - elapsedSeconds * 1000).toISOString(),
    elapsedSeconds,
  };
}

const unresolvedPuzzles = [
  unresolved(101, 'daily-2026-05-25', 'easy', '5x5', 240),
  unresolved(202, 'medium-a', 'medium', '5x5', 640),
  unresolved(303, 'easy-8', 'easy', '8x8', 1200),
  unresolved(404, 'hard-a', 'hard', '5x5', 1840),
];

// ---------------------------------------------------------------------------
// Solving sub-state fixtures
//
// The live SolvingScreen drives its board state internally through
// useGame(), so these frames render <Board> directly with crafted props
// instead. Each fixture starts from a real generated puzzle (so cages and
// the solution are valid) and is mutated for one state. Hints are produced
// by the real engine (findHint) and unrolled into Board props exactly the
// way SolvingScreen does — so the candidate-note / region / chain overlays
// match the shipping component.
// ---------------------------------------------------------------------------

/** A partially solved 5×5: the first `keepEmpty` empty cells are left blank,
 *  the rest are filled from the solution. Returns a fresh, mutable state. */
function partiallySolved(seed: number, keepEmpty: number): GameState {
  const state = puzzleState(seed);
  const empties: [number, number][] = [];
  for (let r = 0; r < state.grid.length; r += 1) {
    for (let c = 0; c < state.grid[r].length; c += 1) {
      if (state.grid[r][c] === 0) empties.push([r, c]);
    }
  }
  // Fill from the end so the kept-empty cells cluster near the top-left,
  // keeping the open region (and any hint) in one readable area.
  for (let i = keepEmpty; i < empties.length; i += 1) {
    const [r, c] = empties[i];
    state.grid[r][c] = state.puzzle.solution[r][c];
  }
  return state;
}

/** Replicates SolvingScreen's cellOverlays for a contradiction chain at its
 *  final step (the whole chain shown). Returns null for non-chain hints. */
function chainOverlays(hint: Hint | null): Map<string, CellOverlay> | null {
  const chain = hint?.chain ?? null;
  if (!chain || chain.length === 0) return null;
  const overlays = new Map<string, CellOverlay>();
  const last = chain.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const entry = chain[i];
    const key = posKey(entry.row, entry.col);
    const highlight =
      i === last
        ? entry.role === 'info'
          ? 'conclusion'
          : entry.role === 'target'
            ? 'assumption'
            : entry.role
        : null;
    const prev = overlays.get(key);
    overlays.set(key, {
      highlight: highlight ?? prev?.highlight ?? null,
      ghostValue:
        entry.value > 0 && entry.role !== 'target'
          ? entry.value
          : (prev?.ghostValue ?? 0),
    });
  }
  return overlays;
}

/** Replicates SolvingScreen's hintNotes for the final step. */
function finalHintNotes(hint: Hint | null): HintNotes | null {
  const n = hint?.notes;
  if (!n) return null;
  if (n.kind !== 'steps') return n;
  const crossed: number[] = [];
  for (const step of n.steps) crossed.push(...step.crossed);
  return { kind: 'grid', cageSize: n.cageSize, crossed, survivor: n.survivor };
}

const TECHNIQUE_LABEL: Record<string, string> = {
  naked_single: 'Naked single',
  hidden_single: 'Hidden single',
  domination: 'Forced move',
  pair_elimination: 'Pair elimination',
  contradiction: 'Contradiction chain',
  reveal: 'Revealed cell',
  candidates: 'Candidates',
  check: 'Error check',
};

/** A static replica of SolvingScreen's nav + status + Board + keypad +
 *  Notes/Hint/Check/Clear toolbar, frozen into one state. No useGame, no
 *  timers — just the visual surface for capture. */
function SolvingState({
  title,
  status,
  gameState,
  selectedCell = null,
  hint = null,
  cellOverlays = null,
  hintNotes = null,
  showErrors = false,
  notesActive = false,
  checkActive = false,
  showingErrors = false,
}: {
  title: string;
  status: string;
  gameState: GameState;
  selectedCell?: [number, number] | null;
  hint?: Hint | null;
  cellOverlays?: Map<string, CellOverlay> | null;
  hintNotes?: HintNotes | null;
  showErrors?: boolean;
  notesActive?: boolean;
  checkActive?: boolean;
  showingErrors?: boolean;
}) {
  const maxNumber = Math.max(
    ...gameState.puzzle.layout.groups.map((g) => g.cells.length),
  );
  const navIconBtn: React.CSSProperties = {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--brand-600)',
  };
  return (
    <div className="flex flex-col">
      <div className="flex h-11 items-center justify-between px-1 pt-4">
        <span style={navIconBtn} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </span>
        <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        <span style={navIconBtn} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pt-2 pb-8">
        <div
          className="text-sm"
          style={{
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {status}
        </div>

        <Board
          gameState={gameState}
          selectedCell={selectedCell}
          hint={hint}
          cellOverlays={cellOverlays}
          onCellClick={() => {}}
          showErrors={showErrors}
          showCoordinates={hint !== null}
          hintNotes={hintNotes}
        />

        <Keypad maxNumber={maxNumber} onNumber={() => {}} />

        <div className="flex w-full gap-2">
          <span className={`solve-tool${notesActive ? ' is-active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 1 1 3.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Notes
          </span>
          <span className="solve-tool">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r=".5" /></svg>
            Hint
          </span>
          {showingErrors ? (
            <span className="solve-tool is-danger">Remove</span>
          ) : (
            <span className={`solve-tool${checkActive ? ' is-active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
              Check
            </span>
          )}
          <span className="solve-tool">
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,207.833H130.344l34.729-34.73.017-.014.015-.017,56.553-56.553a24.03,24.03,0,0,0,0-33.941L176.403,37.323a24,24,0,0,0-33.941,0L85.903,93.882l-.01.01-.01.01L29.324,150.461a24,24,0,0,0,0,33.941l37.089,37.088a8,8,0,0,0,5.657,2.343H216a8,8,0,0,0,0-16ZM153.776,48.638a8,8,0,0,1,11.313,0l45.255,45.255a8.009,8.009,0,0,1,0,11.313l-50.911,50.911L102.865,99.549Z" /></svg>
            Clear
          </span>
          <span className="solve-undo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path transform="rotate(90 12 12)" fillRule="evenodd" clipRule="evenodd" d="M15 3.75A5.25 5.25 0 0 0 9.75 9v10.19l4.72-4.72a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 1 1 1.06-1.06l4.72 4.72V9a6.75 6.75 0 0 1 13.5 0v3a.75.75 0 0 1-1.5 0V9c0-2.9-2.35-5.25-5.25-5.25Z" /></svg>
          </span>
        </div>

        {hint && (
          <div
            className="w-full"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-3)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-block text-xs font-semibold"
                style={{
                  color: 'var(--text-on-brand)',
                  background: 'var(--brand-600)',
                  borderRadius: 'var(--radius-chip)',
                  padding: '2px 10px',
                }}
              >
                {TECHNIQUE_LABEL[hint.type] ?? 'Hint'}
              </span>
              <span
                className="px-2 py-0.5 text-sm font-semibold"
                style={{ color: 'var(--brand-600)' }}
              >
                Skip
              </span>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {hint.reason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** State A — player notes pencilled into several open cells. */
function NotesFilledState() {
  const state = partiallySolved(42, 6);
  // Seed candidate notes into the still-empty cells.
  let seeded = 0;
  for (let r = 0; r < state.grid.length && seeded < 5; r += 1) {
    for (let c = 0; c < state.grid[r].length && seeded < 5; c += 1) {
      if (state.grid[r][c] !== 0) continue;
      const gid = state.puzzle.layout.cellGroup[r][c];
      const size = state.puzzle.layout.groups[gid].cells.length;
      const sol = state.puzzle.solution[r][c];
      // A small plausible candidate set that always contains the answer.
      const set = new Set<number>([sol]);
      for (let v = 1; v <= size && set.size < 3; v += 1) {
        if ((v + r + c) % 2 === 0) set.add(v);
      }
      state.notes[r][c] = set;
      seeded += 1;
    }
  }
  return (
    <SolvingState
      title="Easy · 5×5"
      status="2:14 · 6 left"
      gameState={state}
      notesActive
    />
  );
}

/** State B — a single selected cell, no hint. */
function SelectedCellState() {
  const state = partiallySolved(42, 6);
  // Select the first empty cell.
  let sel: [number, number] = [0, 0];
  outer: for (let r = 0; r < state.grid.length; r += 1) {
    for (let c = 0; c < state.grid[r].length; c += 1) {
      if (state.grid[r][c] === 0) {
        sel = [r, c];
        break outer;
      }
    }
  }
  return (
    <SolvingState
      title="Easy · 5×5"
      status="1:58 · 6 left"
      gameState={state}
      selectedCell={sel}
    />
  );
}

/** State C — Check active, two wrong entries surfaced in red. */
function CheckErrorState() {
  const state = partiallySolved(42, 8);
  // Plant two wrong, non-clue entries and flag them as errors.
  let planted = 0;
  for (let r = 0; r < state.grid.length && planted < 2; r += 1) {
    for (let c = 0; c < state.grid[r].length && planted < 2; c += 1) {
      if (state.grid[r][c] === 0 || state.isClue[r][c]) continue;
      const sol = state.puzzle.solution[r][c];
      const gid = state.puzzle.layout.cellGroup[r][c];
      const size = state.puzzle.layout.groups[gid].cells.length;
      const wrong = sol === 1 ? Math.min(2, size) : 1;
      if (wrong === sol) continue;
      state.grid[r][c] = wrong;
      state.errors[r][c] = true;
      planted += 1;
    }
  }
  return (
    <SolvingState
      title="Easy · 5×5"
      status="3:42 · 0 left"
      gameState={state}
      showErrors
      showingErrors
    />
  );
}

/** State D — a candidate-note hint (naked single) drawn in the target cell. */
function NotesHintState() {
  const state = puzzleState(42);
  const hint = findHint(state.grid, state.puzzle.layout);
  return (
    <SolvingState
      title="Easy · 5×5"
      status="0:09 · 18 left"
      gameState={state}
      selectedCell={hint ? [hint.row, hint.col] : null}
      hint={hint}
      hintNotes={finalHintNotes(hint)}
    />
  );
}

/** State E — a Forced-move region highlight (dominating cage ringed blue). */
function RegionHintState() {
  const state = puzzleState(42, 'expert');
  const hint = findHint(state.grid, state.puzzle.layout);
  return (
    <SolvingState
      title="Expert · 5×5"
      status="0:31 · 21 left"
      gameState={state}
      selectedCell={hint ? [hint.row, hint.col] : null}
      hint={hint}
      hintNotes={finalHintNotes(hint)}
    />
  );
}

/** State F — a contradiction-chain hint, fully stepped (premium). */
function ChainHintState() {
  const state = puzzleState(101, 'expert');
  const hint = findHint(state.grid, state.puzzle.layout);
  return (
    <SolvingState
      title="Expert · 5×5"
      status="1:07 · 22 left"
      gameState={state}
      hint={hint}
      cellOverlays={chainOverlays(hint)}
    />
  );
}

// ---------------------------------------------------------------------------
// Overlay / modal frames
//
// The alert-style modals are position:fixed full-screen overlays. The
// `.exact-phone` frame sets `transform: translateZ(0)`, which makes it the
// containing block for fixed descendants — so each modal fills and clips to
// the 390×844 frame rather than the document. A neutral filler sits behind
// the alert modals so the dimmed backdrop reads in context.
// ---------------------------------------------------------------------------

function NeutralBackdrop({ label }: { label: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center"
      style={{ background: 'var(--surface)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </p>
    </div>
  );
}

const auth: AuthContextValue = {
  status: 'anonymous',
  user: { id: 'anonymous', email: '', isAnonymous: true },
  signInWithApple: async () => ({ ok: true }),
  signInWithGoogle: async () => ({ ok: true }),
  signInWithMagicLink: async () => ({ ok: true, needsConfirmation: true }),
  signOut: async () => {},
};

function Providers({ children }: { children: React.ReactNode }) {
  const profileValue = useMemo(
    () => ({
      profile,
      syncState: 'idle' as const,
      recordSolve: () => null,
      recordTutorial: () => null,
      celebrateStage: () => {},
      skipTutorials: () => {},
      redeemVoucher: () => ({ ok: false as const, reason: 'invalid' as const }),
      devSetProfile: () => {},
    }),
    [],
  );

  return (
    <AuthContext.Provider value={auth}>
      <ProfileContext.Provider value={profileValue}>
        <PaywallContext.Provider value={{ openPaywall: () => {} }}>
          <DevViewContext.Provider value={{ viewAsGuest: true, setViewAsGuest: () => {} }}>
            {children}
          </DevViewContext.Provider>
        </PaywallContext.Provider>
      </ProfileContext.Provider>
    </AuthContext.Provider>
  );
}

function PhoneFrame({
  name,
  children,
  nav = true,
  active = 'home',
}: {
  name: string;
  children: React.ReactNode;
  nav?: boolean;
  active?: Tab;
}) {
  return (
    <article className="capture-card">
      <h2>{name}</h2>
      <div className="exact-phone" data-capture={name}>
        <main className={`phone-main safe-area-pad-top ${nav ? 'nav-clearance' : ''}`}>
          {children}
        </main>
        {nav && <TabBar active={active} onChange={() => {}} onNewPuzzle={() => {}} />}
      </div>
    </article>
  );
}

function SolvingCapture() {
  return (
    <SolvingScreen
      puzzleId="figma-solving"
      initialDifficulty="easy"
      initialGridSize="5x5"
      seed={42}
      initialElapsedSeconds={49}
      isDaily
      onExit={() => {}}
    />
  );
}

function SolvedCapture() {
  const state = puzzleState(42);
  const solvedState = createGameState(state.puzzle, state.puzzle.solution);
  return (
    <SolvedScreen
      gameState={solvedState}
      elapsedSeconds={138}
      difficulty="easy"
      gridSize="5x5"
      techniquesUsed={{ naked_single: 4 }}
      selfAppliedMoves={{ naked_single: 4 }}
      errorsValidated={0}
      isDaily
      getShareUrl={() => 'https://example.test/#share'}
      getHintedCells={() => new Set()}
      onExit={() => {}}
    />
  );
}

function ExactScreens() {
  return (
    <Providers>
      <div className="capture-page">
        <header className="capture-header">
          <h1>Tectonic exact app captures</h1>
          <p>These frames render real React screens and CSS at 390 × 844.</p>
        </header>
        <div className="capture-grid">
          <PhoneFrame name="Today">
            <HomeLanding
              reentryDays={null}
              unresolvedPuzzles={unresolvedPuzzles}
              onOpenSettings={() => {}}
              onStartDaily={() => {}}
              onResumePuzzle={() => {}}
              onShowAllUnresolved={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Solving" nav={false}>
            <SolvingCapture />
          </PhoneFrame>
          <PhoneFrame name="Onboarding" nav={false}>
            <TutorialScreen
              tutorial={NEWCOMER_TUTORIALS[0]}
              index={1}
              total={3}
              onComplete={() => {}}
              onSkip={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Solved">
            <SolvedCapture />
          </PhoneFrame>
          <PhoneFrame name="Stats" active="stats">
            <StatsScreen />
          </PhoneFrame>
          <PhoneFrame name="All unfinished">
            <UnresolvedPuzzlesScreen
              puzzles={unresolvedPuzzles}
              onBack={() => {}}
              onResume={() => {}}
            />
          </PhoneFrame>

          <h2 className="capture-section">Solving sub-states</h2>
          <PhoneFrame name="Solving · notes" nav={false}>
            <NotesFilledState />
          </PhoneFrame>
          <PhoneFrame name="Solving · selected cell" nav={false}>
            <SelectedCellState />
          </PhoneFrame>
          <PhoneFrame name="Solving · check errors" nav={false}>
            <CheckErrorState />
          </PhoneFrame>
          <PhoneFrame name="Solving · candidate hint" nav={false}>
            <NotesHintState />
          </PhoneFrame>
          <PhoneFrame name="Solving · region hint" nav={false}>
            <RegionHintState />
          </PhoneFrame>
          <PhoneFrame name="Solving · contradiction chain" nav={false}>
            <ChainHintState />
          </PhoneFrame>

          <h2 className="capture-section">Overlays &amp; modals</h2>
          <PhoneFrame name="Paywall" nav={false}>
            <Paywall
              open
              onClose={() => {}}
              onSubscribe={() => {}}
              onRestore={() => {}}
              onRedeem={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Difficulty picker" nav={false}>
            <NeutralBackdrop label="Today" />
            <DifficultyPicker
              open
              stage={1}
              onClose={() => {}}
              onStart={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Abandon alert" nav={false}>
            <NeutralBackdrop label="Solving" />
            <AbandonAlert
              open
              onAbandon={() => {}}
              onKeepSolving={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Clear-puzzle alert" nav={false}>
            <NeutralBackdrop label="Solving" />
            <ClearPuzzleAlert
              open
              onClear={() => {}}
              onCancel={() => {}}
            />
          </PhoneFrame>
          <PhoneFrame name="Stage-up card" nav={false}>
            <StageUpCard stage={2} onContinue={() => {}} />
          </PhoneFrame>

          <h2 className="capture-section">Welcome &amp; tutorials</h2>
          <PhoneFrame name="Welcome" nav={false}>
            <WelcomeScreen onStart={() => {}} onSkip={() => {}} />
          </PhoneFrame>
          {NEWCOMER_TUTORIALS.map((tutorial, i) => (
            <PhoneFrame
              key={tutorial.id}
              name={`Tutorial ${i + 1} · ${tutorial.title}`}
              nav={false}
            >
              <TutorialScreen
                tutorial={tutorial}
                index={i + 1}
                total={NEWCOMER_TUTORIALS.length}
                onComplete={() => {}}
                onSkip={() => {}}
              />
            </PhoneFrame>
          ))}
        </div>
      </div>
    </Providers>
  );
}

createRoot(document.getElementById('root')!).render(<ExactScreens />);
