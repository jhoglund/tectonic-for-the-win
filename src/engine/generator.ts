import type { PuzzleLayout, Puzzle, Group, Position, Difficulty } from './types';
import { posKey } from './types';
import { solve } from './solver';

/**
 * Generate a random group/cage layout for a grid using region-growing.
 * Ensures no single-cell groups (min size 2) to improve solvability.
 */
export function generateLayout(
  rows: number,
  cols: number,
  maxGroupSize: number = 5
): PuzzleLayout {
  const minGroupSize = 2;
  const assigned: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  const groupCells: Position[][] = [];
  let groupId = 0;

  // Shuffle cell order for randomness
  const allCells: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      allCells.push([r, c]);
    }
  }
  shuffle(allCells);

  for (const [r, c] of allCells) {
    if (assigned[r][c] !== -1) continue;

    const cells: Position[] = [{ row: r, col: c }];
    assigned[r][c] = groupId;

    const targetSize = randInt(minGroupSize, maxGroupSize);
    let frontier = getOrthogonalNeighbors(r, c, rows, cols).filter(
      ([nr, nc]) => assigned[nr][nc] === -1
    );

    while (cells.length < targetSize && frontier.length > 0) {
      shuffle(frontier);
      const [nr, nc] = frontier[0];

      if (assigned[nr][nc] !== -1) {
        frontier = frontier.filter(([fr, fc]) => !(fr === nr && fc === nc));
        continue;
      }

      cells.push({ row: nr, col: nc });
      assigned[nr][nc] = groupId;

      for (const [nnr, nnc] of getOrthogonalNeighbors(nr, nc, rows, cols)) {
        if (
          assigned[nnr][nnc] === -1 &&
          !frontier.some(([fr, fc]) => fr === nnr && fc === nnc)
        ) {
          frontier.push([nnr, nnc]);
        }
      }

      frontier = frontier.filter(([fr, fc]) => assigned[fr][fc] === -1);
    }

    groupCells.push(cells);
    groupId++;
  }

  // Merge any remaining single-cell groups into an adjacent group
  for (let gid = 0; gid < groupCells.length; gid++) {
    if (groupCells[gid].length > 1) continue;

    const { row, col } = groupCells[gid][0];
    const orthoNeighbors = getOrthogonalNeighbors(row, col, rows, cols);

    // Find an adjacent group to merge into (prefer smallest)
    let bestNeighborGroup = -1;
    let bestSize = Infinity;
    for (const [nr, nc] of orthoNeighbors) {
      const nGroup = assigned[nr][nc];
      if (nGroup !== gid && groupCells[nGroup].length < bestSize) {
        bestSize = groupCells[nGroup].length;
        bestNeighborGroup = nGroup;
      }
    }

    if (bestNeighborGroup !== -1) {
      // Merge into neighbor group
      groupCells[bestNeighborGroup].push({ row, col });
      assigned[row][col] = bestNeighborGroup;
      groupCells[gid] = []; // Mark as empty
    }
  }

  // Rebuild groups array without empty entries
  const groups: Group[] = [];
  const oldToNew = new Map<number, number>();
  for (let gid = 0; gid < groupCells.length; gid++) {
    if (groupCells[gid].length === 0) continue;
    const newId = groups.length;
    oldToNew.set(gid, newId);
    groups.push({ id: newId, cells: groupCells[gid] });
  }

  // Update assigned grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      assigned[r][c] = oldToNew.get(assigned[r][c])!;
    }
  }

  const cellToGroup = new Map<string, number>();
  for (const group of groups) {
    for (const { row, col } of group.cells) {
      cellToGroup.set(posKey(row, col), group.id);
    }
  }

  return { rows, cols, groups, cellToGroup };
}

/**
 * Generate a complete valid Tectonic puzzle.
 */
export function generatePuzzle(
  rows: number,
  cols: number,
  difficulty: Difficulty
): Puzzle {
  for (let attempt = 0; attempt < 200; attempt++) {
    const layout = generateLayout(rows, cols);

    // Fill the grid completely using the solver with randomization
    const emptyClues = Array.from({ length: rows }, () => Array(cols).fill(0));
    const fillResult = solve(layout, emptyClues, { randomize: true });

    if (!fillResult.solved) continue;

    // Remove clues to create the puzzle
    const puzzle = carveClues(layout, fillResult.grid, difficulty);
    if (puzzle) return puzzle;
  }

  throw new Error('Failed to generate puzzle after 200 attempts');
}

/**
 * Remove values from a filled grid to create a puzzle.
 * Uses solve-based verification for speed.
 */
function carveClues(
  layout: PuzzleLayout,
  solution: number[][],
  difficulty: Difficulty
): Puzzle | null {
  const { rows, cols } = layout;
  const clues = solution.map((row) => [...row]);

  const positions: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  const totalCells = rows * cols;
  const targetClues = {
    easy: Math.ceil(totalCells * 0.52),
    medium: Math.ceil(totalCells * 0.40),
    hard: Math.ceil(totalCells * 0.28),
  }[difficulty];

  let currentClueCount = totalCells;

  for (const [r, c] of positions) {
    if (currentClueCount <= targetClues) break;
    if (clues[r][c] === 0) continue;

    const saved = clues[r][c];
    clues[r][c] = 0;

    // Verify the puzzle still has the same unique solution
    const result = solve(layout, clues);
    if (result.solved) {
      let matches = true;
      for (let rr = 0; rr < rows && matches; rr++) {
        for (let cc = 0; cc < cols && matches; cc++) {
          if (result.grid[rr][cc] !== solution[rr][cc]) matches = false;
        }
      }
      if (matches) {
        currentClueCount--;
        continue;
      }
    }

    clues[r][c] = saved;
  }

  // Difficulty check
  const check = solve(layout, clues);
  if (!check.solved) return null;

  const usedBacktrack = check.techniques.includes('backtrack');
  if (difficulty === 'easy' && usedBacktrack) return null;

  return { layout, clues };
}

function getOrthogonalNeighbors(
  row: number,
  col: number,
  rows: number,
  cols: number
): [number, number][] {
  const result: [number, number][] = [];
  if (row > 0) result.push([row - 1, col]);
  if (row < rows - 1) result.push([row + 1, col]);
  if (col > 0) result.push([row, col - 1]);
  if (col < cols - 1) result.push([row, col + 1]);
  return result;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
