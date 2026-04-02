import type { PuzzleLayout } from './types';
import { posKey } from './types';

/** Get all 8-directional neighbors of a cell */
export function getNeighbors(
  row: number,
  col: number,
  rows: number,
  cols: number
): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

/** Check which cells have errors in the current grid */
export function findErrors(
  grid: number[][],
  layout: PuzzleLayout
): boolean[][] {
  const { rows, cols, groups } = layout;
  const errors: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  // Check adjacency constraint: no two adjacent cells share a value
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) continue;
      for (const [nr, nc] of getNeighbors(r, c, rows, cols)) {
        if (grid[nr][nc] !== 0 && grid[r][c] === grid[nr][nc]) {
          errors[r][c] = true;
          errors[nr][nc] = true;
        }
      }
    }
  }

  // Check group constraint: each value appears at most once per group
  for (const group of groups) {
    const seen = new Map<number, [number, number][]>();
    for (const { row, col } of group.cells) {
      const val = grid[row][col];
      if (val === 0) continue;
      if (!seen.has(val)) seen.set(val, []);
      seen.get(val)!.push([row, col]);
    }
    for (const positions of seen.values()) {
      if (positions.length > 1) {
        for (const [r, c] of positions) {
          errors[r][c] = true;
        }
      }
    }
  }

  return errors;
}

/** Check if the grid is fully and correctly solved */
export function isSolved(grid: number[][], layout: PuzzleLayout): boolean {
  const { rows, cols, groups } = layout;

  // All cells must be filled
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) return false;
    }
  }

  // No errors
  const errors = findErrors(grid, layout);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (errors[r][c]) return false;
    }
  }

  // Each group has all required values
  for (const group of groups) {
    const size = group.cells.length;
    const values = new Set(group.cells.map(({ row, col }) => grid[row][col]));
    for (let v = 1; v <= size; v++) {
      if (!values.has(v)) return false;
    }
  }

  return true;
}
