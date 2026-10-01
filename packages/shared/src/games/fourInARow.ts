import { fail, type BaseGameState, type GameRules, type Player } from "./types";

export const FOUR_COLS = 7;
export const FOUR_ROWS = 6;

export interface FourInARowState extends BaseGameState {
  /** Row-major, row 0 is the top. null = empty. */
  cells: (Player | null)[];
  last: number | null;
  winLine: number[] | null;
}

export interface FourInARowMove {
  col: number;
}

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function findLine(cells: (Player | null)[], index: number): number[] | null {
  const player = cells[index];
  if (player === null) return null;
  const r0 = Math.floor(index / FOUR_COLS);
  const c0 = index % FOUR_COLS;
  for (const [dr, dc] of DIRECTIONS) {
    const line = [index];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < FOUR_ROWS && c >= 0 && c < FOUR_COLS && cells[r * FOUR_COLS + c] === player) {
        line.push(r * FOUR_COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export const fourInARow: GameRules<FourInARowState, FourInARowMove> = {
  type: "fourInARow",
  title: "Four in a Row",
  emoji: "🔴",
  blurb: "Drop discs, line up four before they do.",
  initial: () => ({
    turn: 0,
    winner: null,
    cells: Array(FOUR_COLS * FOUR_ROWS).fill(null),
    last: null,
    winLine: null,
  }),
  play(state, move, player) {
    const col = move?.col;
    if (!Number.isInteger(col) || col < 0 || col >= FOUR_COLS) return fail("Pick a column.");
    let row = -1;
    for (let r = FOUR_ROWS - 1; r >= 0; r--) {
      if (state.cells[r * FOUR_COLS + col] === null) {
        row = r;
        break;
      }
    }
    if (row < 0) return fail("That column is full.");
    const index = row * FOUR_COLS + col;
    const cells = state.cells.slice();
    cells[index] = player;
    const winLine = findLine(cells, index);
    const full = cells.every((c) => c !== null);
    return {
      ok: true,
      state: {
        cells,
        last: index,
        winLine,
        winner: winLine ? player : full ? -1 : null,
        turn: player === 0 ? 1 : 0,
      },
    };
  },
};
