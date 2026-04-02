import type { PuzzleLayout } from './types';
import { getNeighbors } from './validator';

export interface SolveResult {
  solved: boolean;
  grid: number[][];
  /** Techniques used during solving (for difficulty rating) */
  techniques: SolveTechnique[];
}

export type SolveTechnique = 'naked_single' | 'hidden_single' | 'backtrack';

interface SolverState {
  rows: number;
  cols: number;
  groups: PuzzleLayout['groups'];
  grid: number[][];
  candidates: number[][][]; // arrays instead of Sets for speed
  neighborCache: [number, number][][][];
  cellGroup: number[][];
  groupSizes: number[];
}

function buildSolverState(layout: PuzzleLayout, _clues: number[][]): SolverState {
  const { rows, cols, groups } = layout;

  const neighborCache: [number, number][][][] = Array.from(
    { length: rows },
    (_, r) =>
      Array.from({ length: cols }, (_, c) => getNeighbors(r, c, rows, cols))
  );

  const cellGroup: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  const groupSizes: number[] = [];
  for (const group of groups) {
    groupSizes[group.id] = group.cells.length;
    for (const { row, col } of group.cells) {
      cellGroup[row][col] = group.id;
    }
  }

  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );

  // Use bitmask-style arrays for candidates (index 0 unused, 1-5 are values)
  const candidates: number[][][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const gs = groupSizes[cellGroup[r][c]];
      const cands: number[] = [];
      for (let v = 1; v <= gs; v++) cands.push(v);
      return cands;
    })
  );

  return { rows, cols, groups, grid, candidates, neighborCache, cellGroup, groupSizes };
}

/**
 * Solve a Tectonic puzzle using constraint propagation + backtracking.
 */
export function solve(
  layout: PuzzleLayout,
  clues: number[][],
  options: { randomize?: boolean } = {}
): SolveResult {
  const state = buildSolverState(layout, clues);
  const { rows, cols, grid } = state;
  const techniques = new Set<SolveTechnique>();

  // Place clues
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (clues[r][c] !== 0) {
        if (!assign(state, r, c, clues[r][c])) {
          return { solved: false, grid, techniques: [...techniques] };
        }
      }
    }
  }

  if (!propagate(state, techniques)) {
    return { solved: false, grid, techniques: [...techniques] };
  }

  if (isComplete(state)) {
    return { solved: true, grid, techniques: [...techniques] };
  }

  techniques.add('backtrack');
  const result = backtrack(state, techniques, options.randomize ?? false);
  return { solved: result, grid, techniques: [...techniques] };
}

function assign(state: SolverState, r: number, c: number, val: number): boolean {
  const { grid, candidates, neighborCache, cellGroup, groups } = state;
  grid[r][c] = val;
  candidates[r][c] = [];

  for (const [nr, nc] of neighborCache[r][c]) {
    candidates[nr][nc] = candidates[nr][nc].filter(v => v !== val);
    if (grid[nr][nc] === 0 && candidates[nr][nc].length === 0) return false;
  }

  const groupId = cellGroup[r][c];
  for (const cell of groups[groupId].cells) {
    if (cell.row === r && cell.col === c) continue;
    candidates[cell.row][cell.col] = candidates[cell.row][cell.col].filter(v => v !== val);
    if (grid[cell.row][cell.col] === 0 && candidates[cell.row][cell.col].length === 0)
      return false;
  }

  return true;
}

function propagate(state: SolverState, techniques: Set<SolveTechnique>): boolean {
  const { rows, cols, groups, grid, candidates } = state;
  let changed = true;
  while (changed) {
    changed = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== 0) continue;
        if (candidates[r][c].length === 0) return false;
        if (candidates[r][c].length === 1) {
          techniques.add('naked_single');
          if (!assign(state, r, c, candidates[r][c][0])) return false;
          changed = true;
        }
      }
    }

    for (const group of groups) {
      const size = group.cells.length;
      for (let v = 1; v <= size; v++) {
        let count = 0;
        let lastR = -1, lastC = -1;
        let alreadyPlaced = false;
        for (const { row, col } of group.cells) {
          if (grid[row][col] === v) { alreadyPlaced = true; break; }
          if (grid[row][col] === 0 && candidates[row][col].includes(v)) {
            count++;
            lastR = row;
            lastC = col;
          }
        }
        if (alreadyPlaced) continue;
        if (count === 0) return false;
        if (count === 1) {
          techniques.add('hidden_single');
          if (!assign(state, lastR, lastC, v)) return false;
          changed = true;
        }
      }
    }
  }
  return true;
}

function isComplete(state: SolverState): boolean {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c] === 0) return false;
    }
  }
  return true;
}

function saveState(state: SolverState): { grid: number[][]; candidates: number[][][] } {
  return {
    grid: state.grid.map(row => [...row]),
    candidates: state.candidates.map(row => row.map(c => [...c])),
  };
}

function restoreState(state: SolverState, saved: { grid: number[][]; candidates: number[][][] }): void {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      state.grid[r][c] = saved.grid[r][c];
      state.candidates[r][c] = [...saved.candidates[r][c]];
    }
  }
}

function backtrack(state: SolverState, techniques: Set<SolveTechnique>, randomize: boolean): boolean {
  const { rows, cols, grid, candidates } = state;

  let minSize = Infinity;
  let bestR = -1;
  let bestC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0 && candidates[r][c].length < minSize) {
        minSize = candidates[r][c].length;
        bestR = r;
        bestC = c;
      }
    }
  }

  if (bestR === -1) return true;
  if (minSize === 0) return false;

  const saved = saveState(state);
  let vals = [...candidates[bestR][bestC]];
  if (randomize) {
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
  }

  for (const val of vals) {
    restoreState(state, saved);
    if (assign(state, bestR, bestC, val) && propagate(state, techniques) && backtrack(state, techniques, randomize)) {
      return true;
    }
  }

  restoreState(state, saved);
  return false;
}

/**
 * Count solutions using constraint propagation + backtracking (fast).
 */
export function countSolutions(
  layout: PuzzleLayout,
  clues: number[][],
  limit: number = 2
): number {
  const state = buildSolverState(layout, clues);
  const { rows, cols } = state;
  const dummyTechniques = new Set<SolveTechnique>();

  // Place clues with propagation
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (clues[r][c] !== 0) {
        if (!assign(state, r, c, clues[r][c])) return 0;
      }
    }
  }

  if (!propagate(state, dummyTechniques)) return 0;
  if (isComplete(state)) return 1;

  let count = 0;

  function search(): void {
    if (count >= limit) return;

    const { grid, candidates } = state;
    let minSize = Infinity;
    let bestR = -1;
    let bestC = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 0 && candidates[r][c].length < minSize) {
          minSize = candidates[r][c].length;
          bestR = r;
          bestC = c;
        }
      }
    }

    if (bestR === -1) { count++; return; }
    if (minSize === 0) return;

    const saved = saveState(state);
    const vals = [...candidates[bestR][bestC]];

    for (const val of vals) {
      if (count >= limit) return;
      restoreState(state, saved);
      if (assign(state, bestR, bestC, val) && propagate(state, dummyTechniques)) {
        if (isComplete(state)) {
          count++;
        } else {
          search();
        }
      }
    }

    restoreState(state, saved);
  }

  search();
  return count;
}
