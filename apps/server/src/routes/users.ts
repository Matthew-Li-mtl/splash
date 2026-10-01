import { Router } from "express";
import { currentUser, notFound } from "../http";
import { User } from "../models/User";
import { toPublicUser } from "../serialize";

export const usersRouter = Router();

/** Profiles are only visible within your own neighborhood. */
usersRouter.get("/:username", async (req, res) => {
  const me = currentUser(req);
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  const visible = user && (user._id.equals(me._id) || (me.neighborhoodId && user.neighborhoodId?.equals(me.neighborhoodId)));
  if (!user || !visible) throw notFound("That person isn't in your neighborhood.");
  res.json(toPublicUser(user));
});
