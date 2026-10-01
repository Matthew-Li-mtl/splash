import type { Difficulty } from "@splash/shared";
import { seededRandom, shuffle } from "../../lib/util";

/** 81 cells, row-major. 0 = empty. */
export type Grid = number[];

const ALL = 0x3fe; // bits 1..9

const boxOf = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

function popcount(n: number) {
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

/**
 * Backtracking search with bitmasks and "fewest candidates first". Calls
 * `onSolution` for each solution; stop by returning true from it.
 */
function search(grid: Grid, rand: (() => number) | null, onSolution: (g: Grid) => boolean) {
  const g = grid.slice();
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const bit = 1 << g[i];
    const r = Math.floor(i / 9);
    const c = i % 9;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[boxOf(r, c)] |= bit;
  }

  const step = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const mask = ALL & ~(rows[r] | cols[c] | boxes[boxOf(r, c)]);
      const n = popcount(mask);
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 0) return false;
      }
    }
    if (best < 0) return onSolution(g);

    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(r, c);
    let digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => bestMask & (1 << d));
    if (rand) digits = shuffle(digits, rand);
    for (const d of digits) {
      const bit = 1 << d;
      g[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (step()) return true;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
    g[best] = 0;
    return false;
  };
  step();
}

export function countSolutions(grid: Grid, limit = 2): number {
  let count = 0;
  search(grid, null, () => ++count >= limit);
  return count;
}

const CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 26 };

/** Deterministic: the same seed and difficulty always produce the same puzzle. */
export function generateSudoku(seed: string, difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const rand = seededRandom(`sudoku-${difficulty}-${seed}`);
  let solution: Grid = [];
  search(Array(81).fill(0), rand, (g) => {
    solution = g.slice();
    return true;
  });

  // Remove cells in symmetric pairs while the solution stays unique.
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffle([...Array(41).keys()], rand)) {
    if (clues <= CLUES[difficulty]) break;
    const j = 80 - i;
    const keep = [puzzle[i], puzzle[j]];
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (countSolutions(puzzle) === 1) {
      clues -= i === j ? 1 : 2;
    } else {
      puzzle[i] = keep[0];
      puzzle[j] = keep[1];
    }
  }
  return { puzzle, solution };
}

/** Indices of cells that clash with another cell (same digit in a row, column or box). */
export function conflicts(values: Grid): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!values[i]) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let j = i + 1; j < 81; j++) {
      if (values[j] !== values[i]) continue;
      const r2 = Math.floor(j / 9);
      const c2 = j % 9;
      if (r === r2 || c === c2 || boxOf(r, c) === boxOf(r2, c2)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

export const peers = (i: number, j: number) => {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const r2 = Math.floor(j / 9);
  const c2 = j % 9;
  return r === r2 || c === c2 || boxOf(r, c) === boxOf(r2, c2);
};
