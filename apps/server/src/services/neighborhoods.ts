import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { NAME_PROPOSAL_DAYS, NEIGHBORHOOD_CAPACITY, type StartMode } from "@splash/shared";
import { badRequest } from "../http";
import { Neighborhood, type NeighborhoodDoc } from "../models/Neighborhood";
import { User, type UserDoc } from "../models/User";
import { hiddenObjectIds } from "./blocks";

const FIRST = [
  "Willow", "Maple", "Juniper", "Birch", "Cedar", "Hazel", "Linden", "Aspen", "Rowan", "Alder",
  "Magnolia", "Elm", "Hawthorn", "Laurel", "Olive", "Sycamore", "Chestnut", "Clover", "Fern", "Ivy",
  "Marigold", "Lantern", "Honeybee", "Bluebird", "Sparrow", "Firefly", "Meadow", "Pebble", "Thistle", "Plum",
];
const SECOND = ["Lane", "Court", "Row", "Way", "Close", "Street", "Terrace", "Crescent", "Hollow", "Walk", "Place", "Circle"];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function interestIncrements(interests: string[], by: 1 | -1) {
  return Object.fromEntries(interests.map((i) => [`interestCounts.${i}`, by]));
}

/**
 * How good a fit an open neighborhood is: mostly shared interests, with a nudge
 * toward fuller neighborhoods so early groups get lively instead of staying sparse.
 */
function fitScore(n: NeighborhoodDoc, interests: string[]): number {
  const members = n.memberCount;
  let overlap = 0;
  if (members > 0 && interests.length > 0) {
    for (const i of interests) overlap += (n.interestCounts.get(i) ?? 0) / members;
    overlap /= interests.length;
  }
  return overlap * 2 + members / NEIGHBORHOOD_CAPACITY;
}

/** 1 if this person asked for invite only, else 0: their share of a street's privateCount. */
const privateShare = (user: UserDoc) => (user.wantsPrivate ? 1 : 0);

/** Atomically claim a seat; returns null if the neighborhood filled up meanwhile. */
async function claimSeat(id: Types.ObjectId, user: UserDoc) {
  return Neighborhood.findOneAndUpdate(
    { _id: id, memberCount: { $lt: NEIGHBORHOOD_CAPACITY } },
    { $inc: { memberCount: 1, privateCount: privateShare(user), ...interestIncrements(user.interests, 1) } },
    { returnDocument: "after" },
  );
}

/** A fresh street with this person as its only member and founder. */
async function createNeighborhood(user: UserDoc) {
  return Neighborhood.create({
    name: `${pick(FIRST)} ${pick(SECOND)}`,
    inviteCode: randomBytes(6).toString("base64url"),
    memberCount: 1,
    privateCount: privateShare(user),
    founderId: user._id,
    interestCounts: new Map(user.interests.map((i) => [i, 1])),
  });
}

/**
 * Seat the user in a neighborhood (they must not currently have one) and save them.
 * - Invite code: join that street (invite only or not; that's what invites are for).
 * - `start: "match"`: the best interest match among *open* streets, so strangers are never
 *   placed on an invite-only street. Only if none has room, a new street.
 * - Otherwise (`"solo"`, the default): a brand-new street of their own.
 */
export async function assignNeighborhood(
  user: UserDoc,
  opts: { inviteCode?: string; start?: StartMode; exclude?: Types.ObjectId } = {},
): Promise<NeighborhoodDoc> {
  let seat: NeighborhoodDoc | null = null;

  if (opts.inviteCode) {
    const invited = await Neighborhood.findOne({ inviteCode: opts.inviteCode });
    if (!invited) throw badRequest("That invite code doesn't match any neighborhood.");
    seat = await claimSeat(invited._id, user);
    if (!seat) throw badRequest("That neighborhood is full. Ask your friend to start a new one, or start your own.");
  } else if (opts.start !== "match") {
    seat = await createNeighborhood(user);
  } else {
    // Never seat someone on the same street as a person they blocked (or who blocked them).
    const hidden = await hiddenObjectIds(user);
    const blockedStreets = hidden.length ? await User.distinct("neighborhoodId", { _id: { $in: hidden } }) : [];
    const avoid = [...blockedStreets.filter(Boolean), ...(opts.exclude ? [opts.exclude] : [])];
    const open = await Neighborhood.find({
      memberCount: { $lt: NEIGHBORHOOD_CAPACITY },
      // Invite only means invite only: skip any street where a member asked for it.
      // ($not $gt also matches older streets with no privateCount at all.)
      privateCount: { $not: { $gt: 0 } },
      ...(avoid.length ? { _id: { $nin: avoid } } : {}),
    })
      .sort({ memberCount: -1 })
      .limit(50);
    open.sort((a, b) => fitScore(b, user.interests) - fitScore(a, user.interests));
    for (const candidate of open) {
      seat = await claimSeat(candidate._id, user);
      if (seat) break;
    }
    seat ??= await createNeighborhood(user);
  }

  user.neighborhoodId = seat._id;
  await user.save();
  return seat;
}

export async function leaveNeighborhood(user: UserDoc) {
  if (!user.neighborhoodId) return;
  const id = user.neighborhoodId;
  await Neighborhood.updateOne(
    { _id: id },
    { $inc: { memberCount: -1, privateCount: -privateShare(user), ...interestIncrements(user.interests, -1) } },
  );
  // An empty street would otherwise linger, and (now open) could be handed to a stranger
  // with its old name and founder. The memberCount condition makes this safe to race.
  await Neighborhood.deleteOne({ _id: id, memberCount: { $lte: 0 } });
  user.neighborhoodId = null;
}

/** Turn this person's invite-only request on or off, keeping their street's privateCount in sync. */
export async function setWantsPrivate(user: UserDoc, wantsPrivate: boolean) {
  if ((user.wantsPrivate ?? false) === wantsPrivate) return;
  if (user.neighborhoodId) {
    await Neighborhood.updateOne({ _id: user.neighborhoodId }, { $inc: { privateCount: wantsPrivate ? 1 : -1 } });
  }
  user.wantsPrivate = wantsPrivate;
}

// ---------- Renaming the street ----------

/** Yes votes needed to rename: at least half of the current members. */
export const votesNeeded = (memberCount: number) => Math.max(1, Math.ceil(memberCount / 2));

export const proposalExpiry = (createdAt: Date) => new Date(createdAt.getTime() + NAME_PROPOSAL_DAYS * 86_400_000);

/**
 * Apply or drop the open rename proposal if it's decided: rename once enough *current* members
 * voted yes (votes from people who moved away don't count), or clear it once it expires.
 * Called after every vote and whenever the street is read, since there are no background jobs.
 */
export async function settleNameProposal(hood: NeighborhoodDoc): Promise<NeighborhoodDoc> {
  const proposal = hood.nameProposal;
  if (!proposal) return hood;
  if (proposalExpiry(proposal.createdAt).getTime() <= Date.now()) {
    hood.nameProposal = null;
    return hood.save();
  }
  const yes = await User.countDocuments({ _id: { $in: proposal.votes }, neighborhoodId: hood._id });
  if (yes < votesNeeded(hood.memberCount)) return hood;
  hood.name = proposal.name;
  hood.named = true;
  hood.nameProposal = null;
  return hood.save();
}

/** Keep the neighborhood's interest tallies in sync when a member edits their interests. */
export async function updateInterestCounts(user: UserDoc, before: string[], after: string[]) {
  if (!user.neighborhoodId) return;
  const removed = before.filter((i) => !after.includes(i));
  const added = after.filter((i) => !before.includes(i));
  if (!removed.length && !added.length) return;
  await Neighborhood.updateOne(
    { _id: user.neighborhoodId },
    { $inc: { ...interestIncrements(removed, -1), ...interestIncrements(added, 1) } },
  );
}
