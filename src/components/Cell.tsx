import type { PuzzleLayout } from '../engine/types';
import { posKey } from '../engine/types';

interface CellProps {
  value: number;
  isClue: boolean;
  isSelected: boolean;
  isError: boolean;
  notes: Set<number>;
  groupSize: number;
  colorIndex: number;
  borders: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  onClick: () => void;
}

const GROUP_COLORS = [
  'bg-amber-200',
  'bg-sky-200',
  'bg-emerald-200',
  'bg-violet-200',
  'bg-rose-200',
];

export function Cell({
  value,
  isClue,
  isSelected,
  isError,
  notes,
  groupSize,
  colorIndex,
  borders,
  onClick,
}: CellProps) {
  const borderClasses = [
    borders.top ? 'border-t-2 border-t-slate-800' : 'border-t border-t-slate-300',
    borders.right ? 'border-r-2 border-r-slate-800' : 'border-r border-r-slate-300',
    borders.bottom ? 'border-b-2 border-b-slate-800' : 'border-b border-b-slate-300',
    borders.left ? 'border-l-2 border-l-slate-800' : 'border-l border-l-slate-300',
  ].join(' ');

  const groupBg = GROUP_COLORS[colorIndex % GROUP_COLORS.length];

  const bgClass = isSelected
    ? 'bg-blue-300'
    : isError
      ? 'bg-red-200'
      : groupBg;

  const textClass = isClue
    ? 'text-slate-800 font-bold'
    : isError
      ? 'text-red-600 font-semibold'
      : 'text-blue-600 font-semibold';

  return (
    <div
      className={`flex items-center justify-center cursor-pointer select-none
        w-12 h-12 sm:w-14 sm:h-14 ${borderClasses} ${bgClass} transition-colors`}
      onClick={onClick}
    >
      {value !== 0 ? (
        <span className={`text-xl ${textClass}`}>{value}</span>
      ) : notes.size > 0 ? (
        <div className="grid grid-cols-3 gap-0 w-full h-full p-0.5">
          {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className="text-[9px] text-slate-400 flex items-center justify-center leading-none"
            >
              {notes.has(n) ? n : ''}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compute which borders of a cell are group boundaries.
 * A thick border means the neighbor in that direction belongs to a different group.
 */
export function computeBorders(
  row: number,
  col: number,
  layout: PuzzleLayout
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const { rows, cols, cellToGroup } = layout;
  const myGroup = cellToGroup.get(posKey(row, col))!;

  return {
    top:
      row === 0 || cellToGroup.get(posKey(row - 1, col)) !== myGroup,
    right:
      col === cols - 1 || cellToGroup.get(posKey(row, col + 1)) !== myGroup,
    bottom:
      row === rows - 1 || cellToGroup.get(posKey(row + 1, col)) !== myGroup,
    left:
      col === 0 || cellToGroup.get(posKey(row, col - 1)) !== myGroup,
  };
}
