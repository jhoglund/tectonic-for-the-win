import type { GameState } from '../engine/types';
import { posKey } from '../engine/types';
import { Cell, computeBorders } from './Cell';

interface BoardProps {
  gameState: GameState;
  selectedCell: [number, number] | null;
  onCellClick: (row: number, col: number) => void;
}

export function Board({ gameState, selectedCell, onCellClick }: BoardProps) {
  const { puzzle, grid, isClue, notes, errors } = gameState;
  const { layout } = puzzle;
  const { rows, cols, groups, cellToGroup } = layout;

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
              borders={borders}
              onClick={() => onCellClick(r, c)}
            />
          );
        })
      )}
    </div>
  );
}
