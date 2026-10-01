export type Player = 0 | 1;

/** -1 means a draw. null means the game is still going. */
export type Winner = Player | -1 | null;

export interface BaseGameState {
  turn: Player;
  winner: Winner;
}

export type MoveResult<S> = { ok: true; state: S } | { ok: false; error: string };

/**
 * Pure rules for a turn-based two-player game. The server uses these to validate
 * moves; the client uses them to render boards and preview moves.
 */
export interface GameRules<S extends BaseGameState = BaseGameState, M = unknown> {
  type: string;
  title: string;
  emoji: string;
  blurb: string;
  initial(): S;
  /** `move` comes from the network, so implementations must validate its shape. */
  play(state: S, move: M, player: Player): MoveResult<S>;
}

export const fail = (error: string) => ({ ok: false, error }) as const;
