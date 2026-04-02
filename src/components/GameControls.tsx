import type { Difficulty } from '../engine/types';

interface GameControlsProps {
  difficulty: Difficulty;
  onNewGame: (difficulty: Difficulty) => void;
  onNumberInput: (num: number) => void;
  onClear: () => void;
  onToggleNotes: () => void;
  notesMode: boolean;
  maxNumber: number;
  isSolved: boolean;
}

export function GameControls({
  difficulty,
  onNewGame,
  onNumberInput,
  onClear,
  onToggleNotes,
  notesMode,
  maxNumber,
  isSolved,
}: GameControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      {isSolved && (
        <div className="text-green-600 font-bold text-xl py-2">
          Puzzle Solved!
        </div>
      )}

      {/* Number buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onNumberInput(n)}
            className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200
              text-slate-800 font-semibold text-lg transition-colors
              border border-slate-300 active:bg-slate-300"
          >
            {n}
          </button>
        ))}
        <button
          onClick={onClear}
          className="w-10 h-10 rounded-lg bg-red-50 hover:bg-red-100
            text-red-600 font-semibold text-sm transition-colors
            border border-red-200 active:bg-red-200"
        >
          X
        </button>
      </div>

      {/* Notes toggle */}
      <button
        onClick={onToggleNotes}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
          ${
            notesMode
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
          }`}
      >
        {notesMode ? 'Notes: ON' : 'Notes: OFF'}
      </button>

      {/* New game buttons */}
      <div className="flex gap-2 mt-2">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => onNewGame(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
              ${
                difficulty === d
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
