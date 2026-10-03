import { Router } from "express";
import type { ProfileDTO } from "@splash/shared";
import { currentUser, notFound } from "../http";
import { Block } from "../models/Block";
import { User } from "../models/User";
import { toPublicUser } from "../serialize";

export const usersRouter = Router();

/**
 * Profiles are only visible within your own neighborhood. If they blocked you, it's
 * a 404 (same as "not your neighbor", so a block isn't revealed). If you blocked
 * them, you still get the profile, flagged, so the page can offer "Unblock".
 */
usersRouter.get("/:username", async (req, res) => {
  const me = currentUser(req);
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  const sameStreet = user && (user._id.equals(me._id) || (me.neighborhoodId && user.neighborhoodId?.equals(me.neighborhoodId)));
  if (!user || !sameStreet) throw notFound("That person isn't in your neighborhood.");

  const [iBlocked, theyBlocked] = await Promise.all([
    Block.exists({ blockerId: me._id, blockedId: user._id }),
    Block.exists({ blockerId: user._id, blockedId: me._id }),
  ]);
  if (theyBlocked && !iBlocked) throw notFound("That person isn't in your neighborhood.");

  const profile: ProfileDTO = { ...toPublicUser(user), blockedByMe: !!iBlocked };
  res.json(profile);
});
