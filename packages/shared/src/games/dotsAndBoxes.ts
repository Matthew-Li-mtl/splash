import { fail, type BaseGameState, type GameRules, type Player } from "./types";

/** Board is BOXES × BOXES boxes, i.e. (BOXES + 1)² dots. */
export const BOXES = 5;

export interface DotsState extends BaseGameState {
  /** Horizontal lines: (BOXES + 1) rows × BOXES columns. Value = who drew it. */
  h: (Player | null)[];
  /** Vertical lines: BOXES rows × (BOXES + 1) columns. */
  v: (Player | null)[];
  /** Box owners: BOXES × BOXES. */
  boxes: (Player | null)[];
  scores: [number, number];
  last: { kind: "h" | "v"; r: number; c: number } | null;
}

export interface DotsMove {
  kind: "h" | "v";
  r: number;
  c: number;
}

export const hIndex = (r: number, c: number) => r * BOXES + c;
export const vIndex = (r: number, c: number) => r * (BOXES + 1) + c;

function boxClosed(s: Pick<DotsState, "h" | "v">, r: number, c: number) {
  return (
    s.h[hIndex(r, c)] !== null &&
    s.h[hIndex(r + 1, c)] !== null &&
    s.v[vIndex(r, c)] !== null &&
    s.v[vIndex(r, c + 1)] !== null
  );
}

export const dotsAndBoxes: GameRules<DotsState, DotsMove> = {
  type: "dotsAndBoxes",
  title: "Dots & Boxes",
  emoji: "🔲",
  blurb: "Close a box to claim it — and go again.",
  initial: () => ({
    turn: 0,
    winner: null,
    h: Array((BOXES + 1) * BOXES).fill(null),
    v: Array(BOXES * (BOXES + 1)).fill(null),
    boxes: Array(BOXES * BOXES).fill(null),
    scores: [0, 0],
    last: null,
  }),
  play(state, move, player) {
    const { kind, r, c } = move ?? ({} as DotsMove);
    if (kind !== "h" && kind !== "v") return fail("Pick a line.");
    const rows = kind === "h" ? BOXES + 1 : BOXES;
    const cols = kind === "h" ? BOXES : BOXES + 1;
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= rows || c < 0 || c >= cols) {
      return fail("That line isn't on the board.");
    }
    const h = state.h.slice();
    const v = state.v.slice();
    if (kind === "h") {
      if (h[hIndex(r, c)] !== null) return fail("That line is taken.");
      h[hIndex(r, c)] = player;
    } else {
      if (v[vIndex(r, c)] !== null) return fail("That line is taken.");
      v[vIndex(r, c)] = player;
    }

    // A line touches at most two boxes.
    const touched: [number, number][] =
      kind === "h"
        ? [
            [r - 1, c],
            [r, c],
          ]
        : [
            [r, c - 1],
            [r, c],
          ];
    const boxes = state.boxes.slice();
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    let claimed = 0;
    for (const [br, bc] of touched) {
      if (br < 0 || br >= BOXES || bc < 0 || bc >= BOXES) continue;
      if (boxes[br * BOXES + bc] === null && boxClosed({ h, v }, br, bc)) {
        boxes[br * BOXES + bc] = player;
        scores[player]++;
        claimed++;
      }
    }

    const done = boxes.every((b) => b !== null);
    return {
      ok: true,
      state: {
        h,
        v,
        boxes,
        scores,
        last: { kind, r, c },
        winner: done ? (scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1) : null,
        // Claiming a box earns another turn.
        turn: claimed > 0 ? player : player === 0 ? 1 : 0,
      },
    };
  },
};
