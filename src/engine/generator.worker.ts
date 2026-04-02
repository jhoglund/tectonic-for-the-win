import type { Difficulty } from './types';
import { generatePuzzle } from './generator';

self.onmessage = (e: MessageEvent<{ rows: number; cols: number; difficulty: Difficulty }>) => {
  const { rows, cols, difficulty } = e.data;
  const puzzle = generatePuzzle(rows, cols, difficulty);
  // Serialize the Map since it can't be passed through postMessage
  const serialized = {
    layout: {
      ...puzzle.layout,
      cellToGroup: Array.from(puzzle.layout.cellToGroup.entries()),
    },
    clues: puzzle.clues,
  };
  self.postMessage(serialized);
};
