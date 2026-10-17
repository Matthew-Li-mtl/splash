import { Router } from "express";
import { z } from "zod";
import { MOVE_COOLDOWN_DAYS, NEIGHBORHOOD_CAPACITY, NEIGHBORHOOD_NAME_MAX, type NeighborhoodDTO } from "@splash/shared";
import { HttpError, badRequest, currentUser, forbidden, notFound } from "../http";
import { Neighborhood, type NeighborhoodDoc } from "../models/Neighborhood";
import { User, type UserDoc } from "../models/User";
import { toMe, toPublicUser } from "../serialize";
import {
  assignNeighborhood,
  leaveNeighborhood,
  proposalExpiry,
  settleNameProposal,
  votesNeeded,
} from "../services/neighborhoods";
import { hiddenUserIds } from "../services/blocks";

export const neighborhoodRouter = Router();

/** The current user's street, creating one of their own if they somehow have none. */
async function myNeighborhood(user: UserDoc): Promise<NeighborhoodDoc> {
  const hood = user.neighborhoodId ? await Neighborhood.findById(user.neighborhoodId) : await assignNeighborhood(user);
  if (!hood) throw notFound("Neighborhood not found.");
  return settleNameProposal(hood);
}

async function neighborhoodDTO(user: UserDoc, hood?: NeighborhoodDoc): Promise<NeighborhoodDTO> {
  hood ??= await myNeighborhood(user);
  const hidden = await hiddenUserIds(user);
  // People hidden by a block aren't listed (in either direction).
  const members = (await User.find({ neighborhoodId: hood._id }).sort({ createdAt: 1 })).filter((m) => !hidden.has(m.id));
  const proposal = hood.nameProposal;
  const proposer = proposal && !hidden.has(proposal.proposerId.toString()) ? await User.findById(proposal.proposerId) : null;
  return {
    id: hood.id,
    name: hood.name,
    inviteCode: hood.inviteCode,
    members: members.map(toPublicUser),
    capacity: NEIGHBORHOOD_CAPACITY,
    createdAt: hood.createdAt.toISOString(),
    inviteOnly: (hood.privateCount ?? 0) > 0,
    canNameFreely: !hood.named && !!hood.founderId?.equals(user._id),
    nameProposal: proposal
      ? {
          name: proposal.name,
          proposedBy: proposer ? toPublicUser(proposer) : null,
          // Only votes from people still on the street count, same as when settling.
          yesVotes: await User.countDocuments({ _id: { $in: proposal.votes }, neighborhoodId: hood._id }),
          votesNeeded: votesNeeded(hood.memberCount),
          votedByMe: proposal.votes.some((id) => id.equals(user._id)),
          expiresAt: proposalExpiry(proposal.createdAt).toISOString(),
        }
      : null,
  };
}

neighborhoodRouter.get("/", async (req, res) => {
  res.json(await neighborhoodDTO(currentUser(req)));
});

const moveSchema = z.object({
  start: z.enum(["solo", "match"]),
  inviteCode: z.string().trim().max(32).optional(),
});

/**
 * Explicit, user-initiated move: start a fresh street, join a friend's with an invite, or be
 * matched with strangers. Only matching has a cooldown; it's the one that can be re-rolled.
 */
neighborhoodRouter.post("/move", async (req, res) => {
  const user = currentUser(req);
  const { start, inviteCode } = moveSchema.parse(req.body);
  const matching = start === "match" && !inviteCode;
  if (matching && user.lastMovedAt) {
    const nextAllowed = user.lastMovedAt.getTime() + MOVE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() < nextAllowed) {
      const days = Math.ceil((nextAllowed - Date.now()) / (24 * 60 * 60 * 1000));
      throw new HttpError(429, `You can be matched again in ${days} day${days === 1 ? "" : "s"}.`);
    }
  }
  if (inviteCode) {
    const target = await Neighborhood.findOne({ inviteCode });
    if (!target) throw badRequest("That invite code doesn't match any neighborhood.");
    if (user.neighborhoodId?.equals(target._id)) throw badRequest("You already live there!");
    // Check before leaving, so a full street doesn't leave you without one.
    if (target.memberCount >= NEIGHBORHOOD_CAPACITY) throw badRequest("That street is full.");
  }
  const previous = user.neighborhoodId ?? undefined;
  await leaveNeighborhood(user);
  // Asking to be matched means being open to strangers, so the new street can't be invite only.
  if (matching) user.wantsPrivate = false;
  if (matching) user.lastMovedAt = new Date();
  await assignNeighborhood(user, { inviteCode, start, exclude: previous });
  res.json({ user: toMe(user), neighborhood: await neighborhoodDTO(user) });
});

// ---------- Renaming the street ----------

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Give your street a name.").max(NEIGHBORHOOD_NAME_MAX, `Keep it to ${NEIGHBORHOOD_NAME_MAX} characters.`)),
});

/** The founder's one free rename, to replace the randomly generated default name. */
neighborhoodRouter.post("/name", async (req, res) => {
  const user = currentUser(req);
  const { name } = nameSchema.parse(req.body);
  const hood = await myNeighborhood(user);
  if (hood.named || !hood.founderId?.equals(user._id)) {
    throw forbidden("Only the founder can name the street, and only once. Suggest a name for a vote instead.");
  }
  hood.name = name;
  hood.named = true;
  hood.nameProposal = null;
  await hood.save();
  res.json(await neighborhoodDTO(user, hood));
});

/** Suggest a new name. Replaces your own open suggestion; blocked while someone else's is open. */
neighborhoodRouter.post("/name-proposal", async (req, res) => {
  const user = currentUser(req);
  const { name } = nameSchema.parse(req.body);
  const hood = await myNeighborhood(user);
  if (name === hood.name) throw badRequest("That's already the name!");
  if (hood.nameProposal && !hood.nameProposal.proposerId.equals(user._id)) {
    throw new HttpError(409, "There's already a name up for a vote. Vote on that one first.");
  }
  hood.nameProposal = { name, proposerId: user._id, votes: [user._id], createdAt: new Date() };
  await hood.save();
  // A street of one (or two) can pass a suggestion with the proposer's own vote.
  res.json(await neighborhoodDTO(user, await settleNameProposal(hood)));
});

/** Vote yes, or take a yes back, on the open suggestion. */
neighborhoodRouter.put("/name-proposal/vote", async (req, res) => {
  const user = currentUser(req);
  const { yes } = z.object({ yes: z.boolean() }).parse(req.body);
  const hood = await myNeighborhood(user);
  if (!hood.nameProposal) throw notFound("There's no name up for a vote.");
  // $addToSet / $pull change only this one array, so simultaneous votes don't overwrite each other.
  const updated = await Neighborhood.findOneAndUpdate(
    { _id: hood._id, nameProposal: { $ne: null } },
    yes ? { $addToSet: { "nameProposal.votes": user._id } } : { $pull: { "nameProposal.votes": user._id } },
    { returnDocument: "after" },
  );
  if (!updated) throw notFound("There's no name up for a vote.");
  res.json(await neighborhoodDTO(user, await settleNameProposal(updated)));
});

/** The proposer can withdraw their suggestion. */
neighborhoodRouter.delete("/name-proposal", async (req, res) => {
  const user = currentUser(req);
  const hood = await myNeighborhood(user);
  if (!hood.nameProposal) throw notFound("There's no name up for a vote.");
  if (!hood.nameProposal.proposerId.equals(user._id)) throw forbidden("Only the person who suggested it can withdraw it.");
  hood.nameProposal = null;
  await hood.save();
  res.json(await neighborhoodDTO(user, hood));
});
