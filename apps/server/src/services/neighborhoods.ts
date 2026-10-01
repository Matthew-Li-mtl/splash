import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { NEIGHBORHOOD_CAPACITY } from "@splash/shared";
import { badRequest } from "../http";
import { Neighborhood, type NeighborhoodDoc } from "../models/Neighborhood";
import type { UserDoc } from "../models/User";

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

/** Atomically claim a seat; returns null if the neighborhood filled up meanwhile. */
async function claimSeat(id: Types.ObjectId, interests: string[]) {
  return Neighborhood.findOneAndUpdate(
    { _id: id, memberCount: { $lt: NEIGHBORHOOD_CAPACITY } },
    { $inc: { memberCount: 1, ...interestIncrements(interests, 1) } },
    { returnDocument: "after" },
  );
}

async function createNeighborhood(interests: string[]) {
  return Neighborhood.create({
    name: `${pick(FIRST)} ${pick(SECOND)}`,
    inviteCode: randomBytes(6).toString("base64url"),
    memberCount: 1,
    interestCounts: new Map(interests.map((i) => [i, 1])),
  });
}

/**
 * Seat the user in a neighborhood (they must not currently have one) and save them.
 * With an invite code they join that neighborhood; otherwise the best interest match.
 */
export async function assignNeighborhood(
  user: UserDoc,
  opts: { inviteCode?: string; exclude?: Types.ObjectId } = {},
): Promise<NeighborhoodDoc> {
  let seat: NeighborhoodDoc | null = null;

  if (opts.inviteCode) {
    const invited = await Neighborhood.findOne({ inviteCode: opts.inviteCode });
    if (!invited) throw badRequest("That invite code doesn't match any neighborhood.");
    seat = await claimSeat(invited._id, user.interests);
    if (!seat) throw badRequest("That neighborhood is full. Sign up without the code to be matched with another one.");
  } else {
    const open = await Neighborhood.find({
      memberCount: { $lt: NEIGHBORHOOD_CAPACITY },
      ...(opts.exclude ? { _id: { $ne: opts.exclude } } : {}),
    })
      .sort({ memberCount: -1 })
      .limit(50);
    open.sort((a, b) => fitScore(b, user.interests) - fitScore(a, user.interests));
    for (const candidate of open) {
      seat = await claimSeat(candidate._id, user.interests);
      if (seat) break;
    }
    seat ??= await createNeighborhood(user.interests);
  }

  user.neighborhoodId = seat._id;
  await user.save();
  return seat;
}

export async function leaveNeighborhood(user: UserDoc) {
  if (!user.neighborhoodId) return;
  await Neighborhood.updateOne(
    { _id: user.neighborhoodId },
    { $inc: { memberCount: -1, ...interestIncrements(user.interests, -1) } },
  );
  user.neighborhoodId = null;
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
