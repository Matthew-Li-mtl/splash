import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { directChannel, neighborhoodChannel, type MessageDTO, type ThreadSummary } from "@splash/shared";
import { badRequest, currentUser, forbidden, notFound } from "../http";
import { Message, type MessageDoc } from "../models/Message";
import { Neighborhood } from "../models/Neighborhood";
import type { UserDoc } from "../models/User";
import { loadUsers, userOrPlaceholder } from "../serialize";
import { isNeighbor } from "../services/access";

export const messagesRouter = Router();

type ChannelInfo = { kind: "neighborhood" } | { kind: "direct"; otherId: string };

/** Parse a channel id and check the user belongs to it. */
async function checkChannel(user: UserDoc, channel: string, forWrite: boolean): Promise<ChannelInfo> {
  if (channel.startsWith("nb_")) {
    if (!user.neighborhoodId || channel !== neighborhoodChannel(user.neighborhoodId.toString())) {
      throw forbidden("That's not your neighborhood's porch.");
    }
    return { kind: "neighborhood" };
  }
  if (channel.startsWith("dm_")) {
    const [, a, b] = channel.split("_");
    const valid = mongoose.isValidObjectId(a) && mongoose.isValidObjectId(b) && a !== b && channel === directChannel(a, b);
    if (!valid) throw notFound("Unknown conversation.");
    const me = user.id as string;
    if (me !== a && me !== b) throw forbidden();
    const otherId = me === a ? b : a;
    // Old conversations stay readable after someone moves; new messages need a current neighbor.
    if (forWrite && !(await isNeighbor(user, otherId))) throw forbidden("You can only message your current neighbors.");
    return { kind: "direct", otherId };
  }
  throw notFound("Unknown conversation.");
}

async function toMessageDTOs(messages: MessageDoc[]): Promise<MessageDTO[]> {
  const users = await loadUsers(messages.map((m) => m.authorId));
  return messages.map((m) => ({
    id: m.id,
    channel: m.channel,
    author: userOrPlaceholder(users, m.authorId),
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** The porch plus every direct conversation the user is part of, most recent first. */
export async function listThreads(user: UserDoc): Promise<ThreadSummary[]> {
  const me = user.id as string;
  const porch = user.neighborhoodId ? neighborhoodChannel(user.neighborhoodId.toString()) : null;

  const latest: MessageDoc[] = await Message.aggregate([
    {
      $match: {
        $or: [
          ...(porch ? [{ channel: porch }] : []),
          { channel: { $regex: `^dm_(${me}_|[0-9a-f]{24}_${me}$)` } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$channel", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]).then((docs) => docs.map((d) => Message.hydrate(d)));

  const lastByChannel = new Map(latest.map((m) => [m.channel, m]));
  const dtos = new Map((await toMessageDTOs(latest)).map((d) => [d.channel, d]));
  const otherIds = latest.filter((m) => m.channel.startsWith("dm_")).map((m) => m.channel.split("_").slice(1).find((id) => id !== me)!);
  const others = await loadUsers(otherIds);

  const unread = (channel: string) => {
    const last = lastByChannel.get(channel);
    if (!last || last.authorId.equals(user._id)) return false;
    const read = user.readMarkers?.get(channel);
    return !read || read < last.createdAt;
  };

  const threads: ThreadSummary[] = [];
  if (porch) {
    const hood = await Neighborhood.findById(user.neighborhoodId, { name: 1 });
    threads.push({
      channel: porch,
      kind: "neighborhood",
      title: `${hood?.name ?? "Neighborhood"} porch`,
      other: null,
      lastMessage: dtos.get(porch) ?? null,
      unread: unread(porch),
    });
  }
  const direct = latest
    .filter((m) => m.channel !== porch)
    .map((m): ThreadSummary => {
      const otherId = m.channel.split("_").slice(1).find((id) => id !== me)!;
      const other = userOrPlaceholder(others, otherId);
      return { channel: m.channel, kind: "direct", title: other.displayName, other, lastMessage: dtos.get(m.channel) ?? null, unread: unread(m.channel) };
    })
    .sort((x, y) => (y.lastMessage?.createdAt ?? "").localeCompare(x.lastMessage?.createdAt ?? ""));
  return [...threads, ...direct];
}

messagesRouter.get("/threads", async (req, res) => {
  res.json(await listThreads(currentUser(req)));
});

/** Latest messages, oldest first. Pass `after` (ISO date) to poll for just the new ones. */
messagesRouter.get("/:channel", async (req, res) => {
  const user = currentUser(req);
  const channel = String(req.params.channel);
  await checkChannel(user, channel, false);
  const filter: Record<string, unknown> = { channel };
  if (typeof req.query.after === "string" && req.query.after) {
    const after = new Date(req.query.after);
    if (Number.isNaN(after.getTime())) throw badRequest("Bad `after` date.");
    filter.createdAt = { $gt: after };
  }
  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(await toMessageDTOs(messages.reverse()));
});

const sendSchema = z.object({ text: z.string().trim().min(1).max(2000) });

messagesRouter.post("/:channel", async (req, res) => {
  const user = currentUser(req);
  const channel = String(req.params.channel);
  await checkChannel(user, channel, true);
  const { text } = sendSchema.parse(req.body);
  const message = await Message.create({ channel, authorId: user._id, text });
  user.readMarkers.set(channel, message.createdAt);
  await user.save();
  res.status(201).json((await toMessageDTOs([message]))[0]);
});

messagesRouter.post("/:channel/read", async (req, res) => {
  const user = currentUser(req);
  const channel = String(req.params.channel);
  await checkChannel(user, channel, false);
  user.readMarkers.set(channel, new Date());
  await user.save();
  res.status(204).end();
});
