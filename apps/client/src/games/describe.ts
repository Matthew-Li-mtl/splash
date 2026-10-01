import type { GameDTO } from "@splash/shared";

export function opponentOf(game: GameDTO) {
  return game.players[game.you === 0 ? 1 : 0];
}

export function isMyTurn(game: GameDTO) {
  return game.status === "active" && game.state.turn === game.you;
}

/** One-line status from the viewer's point of view. */
export function describeGame(game: GameDTO): string {
  const them = opponentOf(game).displayName;
  if (game.status === "active") return isMyTurn(game) ? "Your move" : `Waiting on ${them}`;
  const { winner } = game.state;
  if (winner === -1) return "It's a draw";
  if (game.resignedBy !== null) return game.resignedBy === game.you ? "You resigned" : `${them} resigned. You win!`;
  return winner === game.you ? "You won! 🎉" : `${them} won`;
}
