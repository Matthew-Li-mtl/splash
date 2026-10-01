import { Router } from "express";
import { z } from "zod";
import { GAME_TYPES, getRules, type GameDTO, type GameType, type Player } from "@splash/shared";
import { HttpError, badRequest, currentUser, forbidden, notFound, objectId } from "../http";
import { Game, type GameDoc } from "../models/Game";
import type { UserDoc } from "../models/User";
import { loadUsers, userOrPlaceholder } from "../serialize";
import { isNeighbor } from "../services/access";

export const gamesRouter = Router();

function seatOf(game: GameDoc, user: UserDoc): Player {
  const seat = game.players.findIndex((p) => p.equals(user._id));
  if (seat < 0) throw forbidden("You're not playing in this game.");
  return seat as Player;
}

async function toGameDTOs(games: GameDoc[], user: UserDoc): Promise<GameDTO[]> {
  const users = await loadUsers(games.flatMap((g) => g.players));
  return games.map((g) => ({
    id: g.id,
    type: g.type as GameType,
    players: [userOrPlaceholder(users, g.players[0]), userOrPlaceholder(users, g.players[1])],
    state: g.state,
    status: g.status,
    you: seatOf(g, user),
    resignedBy: (g.resignedBy ?? null) as Player | null,
    moveCount: g.moveCount,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));
}

async function findMyGame(user: UserDoc, id: unknown) {
  const game = await Game.findById(objectId(id, "game"));
  if (!game) throw notFound("Game not found.");
  seatOf(game, user);
  return game;
}

/** Active games (your turn first) plus games finished in the last two weeks. */
gamesRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const games = await Game.find({
    players: user._id,
    $or: [{ status: "active" }, { updatedAt: { $gte: since } }],
  })
    .sort({ updatedAt: -1 })
    .limit(60);
  const dtos = await toGameDTOs(games, user);
  const rank = (g: GameDTO) => (g.status === "active" ? (g.state.turn === g.you ? 0 : 1) : 2);
  dtos.sort((a, b) => rank(a) - rank(b));
  res.json(dtos);
});

const createSchema = z.object({
  type: z.enum(GAME_TYPES as [GameType, ...GameType[]]),
  opponentId: z.string(),
});

/** Challenge a neighbor. Reuses an unfinished game of the same type between the same two people. */
gamesRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = createSchema.parse(req.body);
  const opponentId = objectId(body.opponentId, "neighbor");
  if (opponentId.equals(user._id)) throw badRequest("Challenge a neighbor, not yourself!");
  if (!(await isNeighbor(user, opponentId))) throw forbidden("You can only play with your neighbors.");

  const existing = await Game.findOne({ type: body.type, status: "active", players: { $all: [user._id, opponentId] } });
  if (existing) {
    res.json((await toGameDTOs([existing], user))[0]);
    return;
  }
  const game = await Game.create({
    type: body.type,
    players: [user._id, opponentId],
    state: getRules(body.type)!.initial(),
  });
  res.status(201).json((await toGameDTOs([game], user))[0]);
});

gamesRouter.get("/:id", async (req, res) => {
  const user = currentUser(req);
  res.json((await toGameDTOs([await findMyGame(user, req.params.id)], user))[0]);
});

const moveSchema = z.object({ move: z.unknown(), moveCount: z.number().int().min(0) });

gamesRouter.post("/:id/move", async (req, res) => {
  const user = currentUser(req);
  const { move, moveCount } = moveSchema.parse(req.body);
  const game = await findMyGame(user, req.params.id);
  const seat = seatOf(game, user);
  if (game.status !== "active") throw badRequest("This game is over.");
  if (game.moveCount !== moveCount) throw new HttpError(409, "The board changed. Take another look!");
  if (game.state.turn !== seat) throw badRequest("It's not your turn yet.");

  const result = getRules(game.type)!.play(game.state, move, seat);
  if (!result.ok) throw badRequest(result.error);

  // moveCount doubles as a version number so two quick moves can't both apply.
  const updated = await Game.findOneAndUpdate(
    { _id: game._id, moveCount },
    {
      $set: { state: result.state, status: result.state.winner === null ? "active" : "finished" },
      $inc: { moveCount: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, "The board changed. Take another look!");
  res.json((await toGameDTOs([updated], user))[0]);
});

gamesRouter.post("/:id/resign", async (req, res) => {
  const user = currentUser(req);
  const game = await findMyGame(user, req.params.id);
  if (game.status !== "active") throw badRequest("This game is already over.");
  const seat = seatOf(game, user);
  game.state = { ...game.state, winner: seat === 0 ? 1 : 0 };
  game.status = "finished";
  game.resignedBy = seat;
  game.markModified("state");
  await game.save();
  res.json((await toGameDTOs([game], user))[0]);
});
