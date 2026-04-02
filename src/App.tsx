import { useEffect } from 'react';
import { Board } from './components/Board';
import { GameControls } from './components/GameControls';
import { useGame } from './hooks/useGame';

function App() {
  const {
    gameState,
    difficulty,
    selectedCell,
    notesMode,
    isGenerating,
    startNewGame,
    handleCellClick,
    handleNumberInput,
    handleClear,
    toggleNotes,
  } = useGame();

  // Keyboard support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!gameState || !selectedCell) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        handleNumberInput(num);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleClear();
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        toggleNotes();
        return;
      }

      // Arrow key navigation
      const [r, c] = selectedCell;
      const { rows, cols } = gameState.puzzle.layout;
      let newR = r;
      let newC = c;

      if (e.key === 'ArrowUp') newR = Math.max(0, r - 1);
      else if (e.key === 'ArrowDown') newR = Math.min(rows - 1, r + 1);
      else if (e.key === 'ArrowLeft') newC = Math.max(0, c - 1);
      else if (e.key === 'ArrowRight') newC = Math.min(cols - 1, c + 1);

      if (newR !== r || newC !== c) {
        e.preventDefault();
        handleCellClick(newR, newC);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedCell, handleNumberInput, handleClear, toggleNotes, handleCellClick]);

  // Find max group size for number buttons
  const maxNumber = gameState
    ? Math.max(...gameState.puzzle.layout.groups.map((g) => g.cells.length))
    : 5;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Tectonic</h1>
      <p className="text-slate-500 text-sm mb-6">
        Fill each group with 1..N. No equal neighbors (including diagonals).
      </p>

      {isGenerating ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400 text-lg">Generating puzzle...</p>
        </div>
      ) : gameState ? (
        <div className="flex flex-col items-center gap-6">
          <Board
            gameState={gameState}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
          />
          <GameControls
            difficulty={difficulty}
            onNewGame={startNewGame}
            onNumberInput={handleNumberInput}
            onClear={handleClear}
            onToggleNotes={toggleNotes}
            notesMode={notesMode}
            maxNumber={maxNumber}
            isSolved={gameState.isSolved}
          />
        </div>
      ) : null}

      <p className="text-slate-400 text-xs mt-8">
        Arrow keys to navigate. Press N for notes mode.
      </p>
    </div>
  );
}

export default App;
