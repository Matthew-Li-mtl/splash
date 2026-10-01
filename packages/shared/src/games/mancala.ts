import { fail, type BaseGameState, type GameRules, type Player } from "./types";

export const PITS = 6;
const SEEDS = 4;

/**
 * Kalah rules. Board has 14 slots:
 *   0..5  player 0's pits (left → right from player 0's view), 6 = player 0's store
 *   7..12 player 1's pits, 13 = player 1's store
 * Sowing goes counter-clockwise (increasing index), skipping the opponent's store.
 */
export interface MancalaState extends BaseGameState {
  board: number[];
  last: { player: Player; pit: number } | null;
  /** Human-readable note about the last move ("Extra turn!", "Captured 5"). */
  note: string | null;
}

export interface MancalaMove {
  /** 0..5, relative to the moving player's own row. */
  pit: number;
}

export const storeOf = (p: Player) => (p === 0 ? PITS : PITS * 2 + 1);
export const pitIndex = (p: Player, pit: number) => (p === 0 ? pit : PITS + 1 + pit);

export const mancala: GameRules<MancalaState, MancalaMove> = {
  type: "mancala",
  title: "Mancala",
  emoji: "🫘",
  blurb: "Sow seeds around the board, fill your store.",
  initial: () => {
    const board = Array(PITS * 2 + 2).fill(SEEDS);
    board[storeOf(0)] = 0;
    board[storeOf(1)] = 0;
    return { turn: 0, winner: null, board, last: null, note: null };
  },
  play(state, move, player) {
    const pit = move?.pit;
    if (!Number.isInteger(pit) || pit < 0 || pit >= PITS) return fail("Pick one of your pits.");
    const board = state.board.slice();
    const start = pitIndex(player, pit);
    let seeds = board[start];
    if (seeds === 0) return fail("That pit is empty.");

    board[start] = 0;
    let i = start;
    const skip = storeOf(player === 0 ? 1 : 0);
    while (seeds > 0) {
      i = (i + 1) % board.length;
      if (i === skip) continue;
      board[i]++;
      seeds--;
    }

    let note: string | null = null;
    let nextTurn: Player = player === 0 ? 1 : 0;
    const ownStore = storeOf(player);
    const ownSide = player === 0 ? i < PITS : i > PITS && i < PITS * 2 + 1;

    if (i === ownStore) {
      nextTurn = player;
      note = "Extra turn!";
    } else if (ownSide && board[i] === 1) {
      const opposite = PITS * 2 - i;
      if (board[opposite] > 0) {
        const captured = board[opposite] + 1;
        board[ownStore] += captured;
        board[opposite] = 0;
        board[i] = 0;
        note = `Captured ${captured}!`;
      }
    }

    // Game ends when either row is empty; remaining seeds go to their owner's store.
    const sideEmpty = (p: Player) =>
      board.slice(pitIndex(p, 0), pitIndex(p, 0) + PITS).every((n) => n === 0);
    let winner: MancalaState["winner"] = null;
    if (sideEmpty(0) || sideEmpty(1)) {
      for (const p of [0, 1] as Player[]) {
        for (let k = 0; k < PITS; k++) {
          board[storeOf(p)] += board[pitIndex(p, k)];
          board[pitIndex(p, k)] = 0;
        }
      }
      const a = board[storeOf(0)];
      const b = board[storeOf(1)];
      winner = a === b ? -1 : a > b ? 0 : 1;
    }

    return {
      ok: true,
      state: { board, last: { player, pit }, note, winner, turn: nextTurn },
    };
  },
};
