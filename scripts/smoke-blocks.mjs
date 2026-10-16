// Smoke test for blocking. Run against a DEV server/database only (it writes data):
//   npm run smoke:blocks -- http://localhost:4000
const BASE = process.argv[2] ?? "http://localhost:4000";
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

async function call(path, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const suffix = Date.now().toString(36).slice(-5);
// Works before and after the secure-auth change (`token` became `accessToken`).
const tokenOf = (r) => r.data.accessToken ?? r.data.token;
async function reg(name, inviteCode) {
  const r = await call("/api/auth/register", {
    method: "POST",
    body: { username: `${name}_${suffix}`, displayName: name, password: "password123", avatar: { emoji: "🦊", color: "#f4a261" }, interests: [], inviteCode },
  });
  if (r.status !== 201) throw new Error(`register ${name} failed: ${JSON.stringify(r.data)}`);
  return { id: r.data.user.id, username: r.data.user.username, token: tokenOf(r) };
}

// Three people on one street (invite codes guarantee the same neighborhood).
const ann = await reg("ann");
const hood = await call("/api/neighborhood", { token: ann.token });
const ben = await reg("ben", hood.data.inviteCode);
const cy = await reg("cy", hood.data.inviteCode);
const porch = `nb_${hood.data.id}`;
const dm = `dm_${[ann.id, ben.id].sort().join("_")}`;

// Activity before the block.
const post = (who, text) => call("/api/posts", { token: who.token, method: "POST", body: { kind: "writing", content: { text }, visibility: "neighbors" } });
const annPost = (await post(ann, "ann's post")).data;
const benPost = (await post(ben, "ben's post")).data;
await call(`/api/posts/${annPost.id}/comments`, { token: ben.token, method: "POST", body: { text: "ben was here" } });
await call(`/api/posts/${annPost.id}/comments`, { token: cy.token, method: "POST", body: { text: "cy was here" } });
await call(`/api/posts/${annPost.id}/reactions`, { token: ben.token, method: "PUT", body: { emoji: "❤️" } });
await call(`/api/posts/${annPost.id}/reactions`, { token: cy.token, method: "PUT", body: { emoji: "❤️" } });
await call(`/api/messages/${porch}`, { token: ben.token, method: "POST", body: { text: "ben on the porch" } });
await call(`/api/messages/${dm}`, { token: ann.token, method: "POST", body: { text: "hi ben" } });
const game = (await call("/api/games", { token: ann.token, method: "POST", body: { type: "fourInARow", opponentId: ben.id } })).data;

// Block.
const self = await call("/api/blocks", { token: ann.token, method: "POST", body: { userId: ann.id } });
check(self.status === 400, "can't block yourself");
const ghost = await call("/api/blocks", { token: ann.token, method: "POST", body: { userId: "0123456789abcdef01234567" } });
check(ghost.status === 404, "blocking an unknown user → 404");
const blk = await call("/api/blocks", { token: ann.token, method: "POST", body: { userId: ben.id } });
const blk2 = await call("/api/blocks", { token: ann.token, method: "POST", body: { userId: ben.id } });
check(blk.status === 204 && blk2.status === 204, "ann blocks ben (idempotent)");

const list = await call("/api/blocks", { token: ann.token });
check(list.data.length === 1 && list.data[0].user.id === ben.id, "ann's blocked list shows ben");
const benList = await call("/api/blocks", { token: ben.token });
check(benList.data.length === 0, "ben's own blocked list is empty (he isn't told)");

// Feeds: mutual invisibility; third parties unaffected.
const feedIds = async (who) => (await call("/api/posts/feed", { token: who.token })).data.posts.map((p) => p.id);
const annFeed = await feedIds(ann), benFeed = await feedIds(ben), cyFeed = await feedIds(cy);
check(!annFeed.includes(benPost.id), "ann's feed hides ben's posts");
check(!benFeed.includes(annPost.id), "ben's feed hides ann's posts");
check(cyFeed.includes(annPost.id) && cyFeed.includes(benPost.id), "cy still sees both");

// Posts, replies, reactions.
check((await call(`/api/posts/${benPost.id}`, { token: ann.token })).status === 404, "ann can't open ben's post");
check((await call(`/api/posts/${annPost.id}`, { token: ben.token })).status === 404, "ben can't open ann's post");
check((await call(`/api/posts/${annPost.id}/comments`, { token: ben.token, method: "POST", body: { text: "hey" } })).status === 404, "ben can't reply to ann's post");
check((await call(`/api/posts/${annPost.id}/reactions`, { token: ben.token, method: "PUT", body: { emoji: "✨" } })).status === 404, "ben can't react to ann's post");
const annView = (await call(`/api/posts/${annPost.id}`, { token: ann.token })).data;
check(annView.commentCount === 1, `ann's reply count excludes ben's reply (got ${annView.commentCount})`);
check(annView.reactions.every((r) => !r.userIds.includes(ben.id)) && annView.reactions[0]?.userIds.includes(cy.id), "ann's reactions exclude ben's, keep cy's");
const annComments = (await call(`/api/posts/${annPost.id}/comments`, { token: ann.token })).data;
check(annComments.length === 1 && annComments[0].author.id === cy.id, "ann's replies list hides ben's reply");
const cyView = (await call(`/api/posts/${annPost.id}`, { token: cy.token })).data;
check(cyView.commentCount === 2, "cy still sees both replies");

// Profiles and neighbor lists.
const annSeesBen = await call(`/api/users/${ben.username}`, { token: ann.token });
check(annSeesBen.status === 200 && annSeesBen.data.blockedByMe === true, "ann sees ben's profile flagged blockedByMe (to unblock)");
check((await call(`/api/users/${ann.username}`, { token: ben.token })).status === 404, "ben gets 404 for ann's profile");
check((await call(`/api/posts?author=${ben.id}`, { token: ann.token })).status === 404, "ann can't list ben's posts");
const members = async (who) => (await call("/api/neighborhood", { token: who.token })).data.members.map((m) => m.id);
check(!(await members(ann)).includes(ben.id), "ann's neighbor list hides ben");
check(!(await members(ben)).includes(ann.id), "ben's neighbor list hides ann");
const cyMembers = await members(cy);
check(cyMembers.includes(ann.id) && cyMembers.includes(ben.id), "cy's neighbor list has both");

// Porch and DMs.
const annPorch = (await call(`/api/messages/${porch}`, { token: ann.token })).data;
check(!annPorch.some((m) => m.author.id === ben.id), "ann's porch hides ben's messages");
const cyPorch = (await call(`/api/messages/${porch}`, { token: cy.token })).data;
check(cyPorch.some((m) => m.author.id === ben.id), "cy's porch still shows ben");
check((await call(`/api/messages/${dm}`, { token: ann.token })).status === 404, "ann can't open the DM with ben");
check((await call(`/api/messages/${dm}`, { token: ben.token, method: "POST", body: { text: "hello?" } })).status === 404, "ben can't message ann");
const annThreads = (await call("/api/messages/threads", { token: ann.token })).data;
check(!annThreads.some((t) => t.channel === dm), "the DM disappears from ann's conversations");
check(annThreads[0].lastMessage === null || annThreads[0].lastMessage.author.id !== ben.id, "porch preview never shows ben");

// Games.
check((await call(`/api/games/${game.id}`, { token: ann.token })).status === 404, "the game between them is hidden");
check(!(await call("/api/games", { token: ben.token })).data.some((g) => g.id === game.id), "and gone from ben's game list");
check((await call("/api/games", { token: ben.token, method: "POST", body: { type: "mancala", opponentId: ann.id } })).status === 403, "ben can't challenge ann");

// Unblock restores visibility.
const unb = await call(`/api/blocks/${ben.id}`, { token: ann.token, method: "DELETE" });
check(unb.status === 204 && (await feedIds(ann)).includes(benPost.id), "unblock restores ben's posts in ann's feed");
check((await call(`/api/messages/${dm}`, { token: ann.token })).status === 200, "the DM is readable again after unblocking");
const g2 = (await call(`/api/games/${game.id}`, { token: ann.token })).data;
check(g2.status === "finished" && g2.cancelled === true, "the old game stays ended (cancelled, no winner)");

// Moving never lands you next to someone you blocked.
await call("/api/blocks", { token: ann.token, method: "POST", body: { userId: ben.id } });
const moved = await call("/api/neighborhood/move", { token: ann.token, method: "POST" });
const benHood = (await call("/api/neighborhood", { token: ben.token })).data.id;
check(moved.status === 200 && moved.data.neighborhood.id !== benHood, "after moving, ann isn't placed on ben's street");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
