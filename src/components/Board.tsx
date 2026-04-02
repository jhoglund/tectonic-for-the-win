import { useMemo } from 'react';
import type { GameState, PuzzleLayout } from '../engine/types';
import { posKey } from '../engine/types';
import { Cell, computeBorders } from './Cell';

/**
 * Greedy graph coloring: assign colors to groups so that
 * no two orthogonally adjacent groups share the same color.
 */
function colorGroups(layout: PuzzleLayout): number[] {
  const { rows, cols, groups, cellToGroup } = layout;

  // Build adjacency: two groups are neighbors if any of their cells
  // are orthogonally adjacent
  const adj = new Map<number, Set<number>>();
  for (const group of groups) {
    adj.set(group.id, new Set());
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gid = cellToGroup.get(posKey(r, c))!;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const nid = cellToGroup.get(posKey(nr, nc))!;
          if (nid !== gid) adj.get(gid)!.add(nid);
        }
      }
    }
  }

  // Greedy coloring
  const colors = new Array(groups.length).fill(-1);
  for (const group of groups) {
    const usedByNeighbors = new Set<number>();
    for (const nid of adj.get(group.id)!) {
      if (colors[nid] !== -1) usedByNeighbors.add(colors[nid]);
    }
    let color = 0;
    while (usedByNeighbors.has(color)) color++;
    colors[group.id] = color;
  }
  return colors;
}

interface BoardProps {
  gameState: GameState;
  selectedCell: [number, number] | null;
  onCellClick: (row: number, col: number) => void;
}

export function Board({ gameState, selectedCell, onCellClick }: BoardProps) {
  const { puzzle, grid, isClue, notes, errors } = gameState;
  const { layout } = puzzle;
  const { rows, cols, groups, cellToGroup } = layout;

  const groupColors = useMemo(() => colorGroups(layout), [layout]);

  return (
    <div
      className="inline-grid border-2 border-slate-800 bg-slate-800"
      style={{
        gridTemplateColumns: `repeat(${cols}, auto)`,
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const groupId = cellToGroup.get(posKey(r, c))!;
          const groupSize = groups[groupId].cells.length;
          const borders = computeBorders(r, c, layout);
          const isSelected =
            selectedCell !== null &&
            selectedCell[0] === r &&
            selectedCell[1] === c;

          return (
            <Cell
              key={posKey(r, c)}
              value={grid[r][c]}
              isClue={isClue[r][c]}
              isSelected={isSelected}
              isError={errors[r][c]}
              notes={notes[r][c]}
              groupSize={groupSize}
              colorIndex={groupColors[groupId]}
              borders={borders}
              onClick={() => onCellClick(r, c)}
            />
          );
        })
      )}
    </div>
  );
}
