import { dotsAndBoxes } from "./dotsAndBoxes";
import { fourInARow } from "./fourInARow";
import { mancala } from "./mancala";
import type { BaseGameState, GameRules } from "./types";

export * from "./types";
export * from "./fourInARow";
export * from "./dotsAndBoxes";
export * from "./mancala";

/** Add a game: write its rules file, register it here, then add a board in the client. */
export const GAMES = {
  fourInARow,
  dotsAndBoxes,
  mancala,
} satisfies Record<string, GameRules<any, any>>;

export type GameType = keyof typeof GAMES;
export const GAME_TYPES = Object.keys(GAMES) as GameType[];

export function getRules(type: string): GameRules<BaseGameState, unknown> | null {
  return (GAMES as Record<string, GameRules<any, any>>)[type] ?? null;
}
