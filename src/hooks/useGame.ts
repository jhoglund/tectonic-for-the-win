import { useState, useCallback, useEffect } from 'react';
import type { GameState, Difficulty, Puzzle } from '../engine/types';
import { posKey } from '../engine/types';
import { findErrors, isSolved } from '../engine/validator';
import { generatePuzzle } from '../engine/generator';

function createGameState(puzzle: Puzzle): GameState {
  const { layout, clues } = puzzle;
  const { rows, cols } = layout;

  const grid = clues.map((row) => [...row]);
  const isClue = clues.map((row) => row.map((v) => v !== 0));
  const notes = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => new Set<number>())
  );
  const errors = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  ) as boolean[][];

  return {
    puzzle,
    grid,
    isClue,
    notes,
    errors,
    isSolved: false,
  };
}

export function useGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const startNewGame = useCallback((diff: Difficulty) => {
    setIsGenerating(true);
    setDifficulty(diff);
    setSelectedCell(null);
    setNotesMode(false);

    // Use setTimeout to let UI update with "Generating..." before blocking
    setTimeout(() => {
      const puzzle = generatePuzzle(5, 5, diff);
      setGameState(createGameState(puzzle));
      setIsGenerating(false);
    }, 50);
  }, []);

  // Auto-start a game on mount
  useEffect(() => {
    startNewGame('easy');
  }, [startNewGame]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!gameState) return;
      setSelectedCell([row, col]);
    },
    [gameState]
  );

  const handleNumberInput = useCallback(
    (num: number) => {
      if (!gameState || !selectedCell) return;
      const [r, c] = selectedCell;
      if (gameState.isClue[r][c]) return;

      setGameState((prev) => {
        if (!prev) return prev;
        const newGrid = prev.grid.map((row) => [...row]);
        const newNotes = prev.notes.map((row) =>
          row.map((s) => new Set(s))
        );

        if (notesMode) {
          // Toggle note
          if (newNotes[r][c].has(num)) {
            newNotes[r][c].delete(num);
          } else {
            newNotes[r][c].add(num);
          }
          newGrid[r][c] = 0; // Clear value when adding notes
        } else {
          // Set value (toggle off if same number)
          newGrid[r][c] = newGrid[r][c] === num ? 0 : num;
          newNotes[r][c].clear(); // Clear notes when setting value
        }

        const newErrors = findErrors(newGrid, prev.puzzle.layout);
        const solved = isSolved(newGrid, prev.puzzle.layout);

        return {
          ...prev,
          grid: newGrid,
          notes: newNotes,
          errors: newErrors,
          isSolved: solved,
        };
      });
    },
    [gameState, selectedCell, notesMode]
  );

  const handleClear = useCallback(() => {
    if (!gameState || !selectedCell) return;
    const [r, c] = selectedCell;
    if (gameState.isClue[r][c]) return;

    setGameState((prev) => {
      if (!prev) return prev;
      const newGrid = prev.grid.map((row) => [...row]);
      const newNotes = prev.notes.map((row) =>
        row.map((s) => new Set(s))
      );
      newGrid[r][c] = 0;
      newNotes[r][c].clear();
      const newErrors = findErrors(newGrid, prev.puzzle.layout);

      return {
        ...prev,
        grid: newGrid,
        notes: newNotes,
        errors: newErrors,
        isSolved: false,
      };
    });
  }, [gameState, selectedCell]);

  const toggleNotes = useCallback(() => {
    setNotesMode((prev) => !prev);
  }, []);

  return {
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
  };
}
