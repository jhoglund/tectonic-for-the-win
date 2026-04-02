import type { PuzzleLayout, Puzzle, Group, Position, Difficulty } from './types';
import { posKey } from './types';
import { solve, countSolutions } from './solver';

/**
 * Generate a random group/cage layout for a grid using region-growing.
 * Each group will have between 1 and maxGroupSize cells.
 */
export function generateLayout(
  rows: number,
  cols: number,
  maxGroupSize: number = 5
): PuzzleLayout {
  const assigned: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  const groups: Group[] = [];
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

    // Start a new group from this cell
    const cells: Position[] = [{ row: r, col: c }];
    assigned[r][c] = groupId;

    // Grow the group randomly
    const targetSize = randInt(2, maxGroupSize);
    let frontier = getOrthogonalNeighbors(r, c, rows, cols).filter(
      ([nr, nc]) => assigned[nr][nc] === -1
    );

    while (cells.length < targetSize && frontier.length > 0) {
      shuffle(frontier);
      const [nr, nc] = frontier[0];

      if (assigned[nr][nc] !== -1) {
        frontier = frontier.filter(
          ([fr, fc]) => !(fr === nr && fc === nc)
        );
        continue;
      }

      cells.push({ row: nr, col: nc });
      assigned[nr][nc] = groupId;

      // Add new cell's unassigned orthogonal neighbors to frontier
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

    groups.push({ id: groupId, cells });
    groupId++;
  }

  // Build cellToGroup map
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
  // Keep trying layouts until we get one that produces a solvable puzzle
  for (let attempt = 0; attempt < 50; attempt++) {
    const layout = generateLayout(rows, cols);

    // Fill the grid completely using the solver with randomization
    const emptyClues = Array.from({ length: rows }, () => Array(cols).fill(0));
    const fillResult = solve(layout, emptyClues, { randomize: true });

    if (!fillResult.solved) continue;

    // Now remove clues to create the puzzle
    const puzzle = carveClues(layout, fillResult.grid, difficulty);
    if (puzzle) return puzzle;
  }

  // Fallback: should rarely happen
  throw new Error('Failed to generate puzzle after 50 attempts');
}

/**
 * Remove values from a filled grid to create a puzzle with a unique solution.
 */
function carveClues(
  layout: PuzzleLayout,
  solution: number[][],
  difficulty: Difficulty
): Puzzle | null {
  const { rows, cols } = layout;
  const clues = solution.map((row) => [...row]);

  // Get all cell positions, shuffled
  const positions: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  // Determine how aggressively to remove clues based on difficulty
  const totalCells = rows * cols;
  const targetClues = {
    easy: Math.ceil(totalCells * 0.50),
    medium: Math.ceil(totalCells * 0.35),
    hard: Math.ceil(totalCells * 0.22),
  }[difficulty];

  let currentClueCount = totalCells;

  for (const [r, c] of positions) {
    if (currentClueCount <= targetClues) break;
    if (clues[r][c] === 0) continue;

    const saved = clues[r][c];
    clues[r][c] = 0;

    // Check unique solvability
    if (countSolutions(layout, clues, 2) === 1) {
      currentClueCount--;
    } else {
      clues[r][c] = saved; // Restore — removing this creates ambiguity
    }
  }

  // Verify difficulty by solving and checking techniques used
  const solveResult = solve(layout, clues);
  if (!solveResult.solved) return null;

  const usedBacktrack = solveResult.techniques.includes('backtrack');
  if (difficulty === 'easy' && usedBacktrack) return null;
  if (difficulty === 'medium' && usedBacktrack) return null;

  return { layout, clues };
}

/** Get orthogonal (4-directional) neighbors */
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
