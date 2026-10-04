import { Router } from "express";
import { MOVE_COOLDOWN_DAYS, NEIGHBORHOOD_CAPACITY, type NeighborhoodDTO } from "@splash/shared";
import { HttpError, currentUser, notFound } from "../http";
import { Neighborhood } from "../models/Neighborhood";
import { User, type UserDoc } from "../models/User";
import { toMe, toPublicUser } from "../serialize";
import { assignNeighborhood, leaveNeighborhood } from "../services/neighborhoods";
import { hiddenUserIds } from "../services/blocks";

export const neighborhoodRouter = Router();

async function neighborhoodDTO(user: UserDoc): Promise<NeighborhoodDTO> {
  const hood = user.neighborhoodId
    ? await Neighborhood.findById(user.neighborhoodId)
    : await assignNeighborhood(user);
  if (!hood) throw notFound("Neighborhood not found.");
  const hidden = await hiddenUserIds(user);
  // People hidden by a block aren't listed (in either direction).
  const members = (await User.find({ neighborhoodId: hood._id }).sort({ createdAt: 1 })).filter((m) => !hidden.has(m.id));
  return {
    id: hood.id,
    name: hood.name,
    inviteCode: hood.inviteCode,
    members: members.map(toPublicUser),
    capacity: NEIGHBORHOOD_CAPACITY,
    createdAt: hood.createdAt.toISOString(),
  };
}

neighborhoodRouter.get("/", async (req, res) => {
  res.json(await neighborhoodDTO(currentUser(req)));
});

/** Explicit, rare, user-initiated move to a different neighborhood. */
neighborhoodRouter.post("/move", async (req, res) => {
  const user = currentUser(req);
  if (user.lastMovedAt) {
    const nextAllowed = user.lastMovedAt.getTime() + MOVE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() < nextAllowed) {
      const days = Math.ceil((nextAllowed - Date.now()) / (24 * 60 * 60 * 1000));
      throw new HttpError(429, `You can move again in ${days} day${days === 1 ? "" : "s"}.`);
    }
  }
  const previous = user.neighborhoodId ?? undefined;
  await leaveNeighborhood(user);
  user.lastMovedAt = new Date();
  await assignNeighborhood(user, { exclude: previous });
  res.json({ user: toMe(user), neighborhood: await neighborhoodDTO(user) });
});
