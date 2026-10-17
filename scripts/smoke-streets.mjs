// Streets smoke test: solo sign-up, invite-only privacy, matching, renaming and moving.
// Run against a DEV server/database only (it writes data):  npm run smoke:streets -- http://localhost:4000
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
async function reg(name, extra = {}) {
  const r = await call("/api/auth/register", {
    method: "POST",
    body: { username: `${name}_${suffix}`, displayName: name, password: "password123", interests: ["music"], ...extra },
  });
  if (r.status !== 201) throw new Error(`register ${name} failed: ${JSON.stringify(r.data)}`);
  return { id: r.data.user.id, me: r.data.user, token: r.data.accessToken };
}
const street = (u) => call("/api/neighborhood", { token: u.token }).then((r) => r.data);

// ---- solo by default ----
const fay = await reg("fay");
let s = await street(fay);
check(s.members.length === 1 && s.members[0].id === fay.id, "signing up without an invite starts your own street");
check(fay.me.wantsPrivate === true && s.inviteOnly === true, "new accounts are invite only by default");
check(s.canNameFreely === true, "the founder can name the street");

// ---- the founder's one free rename ----
const named = await call("/api/neighborhood/name", { token: fay.token, method: "POST", body: { name: "  Fay's   Place " } });
check(named.status === 200 && named.data.name === "Fay's Place" && !named.data.canNameFreely, "founder renames once (whitespace tidied)");
const namedAgain = await call("/api/neighborhood/name", { token: fay.token, method: "POST", body: { name: "Again" } });
check(namedAgain.status === 403, "the free rename only works once");

// ---- invites always work, even on invite-only streets ----
const gus = await reg("gus", { inviteCode: s.inviteCode });
check(gus.me.neighborhoodId === s.id, "invite code joins an invite-only street");
const gusFree = await call("/api/neighborhood/name", { token: gus.token, method: "POST", body: { name: "Gus Town" } });
check(gusFree.status === 403, "non-founders can't rename without a vote");

// ---- rename votes: at least half the street ----
// Two members: half is one, so the proposer's own vote passes it.
const p2 = await call("/api/neighborhood/name-proposal", { token: gus.token, method: "POST", body: { name: "Pancake Row" } });
check(p2.status === 200 && p2.data.name === "Pancake Row" && p2.data.nameProposal === null, "2 members: a suggestion passes with the proposer's vote");

const hal = await reg("hal", { inviteCode: s.inviteCode });
// Three members: two yes votes needed.
const p3 = await call("/api/neighborhood/name-proposal", { token: hal.token, method: "POST", body: { name: "Waffle Way" } });
check(p3.data.name === "Pancake Row" && p3.data.nameProposal?.yesVotes === 1 && p3.data.nameProposal?.votesNeeded === 2, "3 members: 1 of 2 votes, not passed yet");
const rival = await call("/api/neighborhood/name-proposal", { token: fay.token, method: "POST", body: { name: "Crepe Court" } });
check(rival.status === 409, "only one open suggestion at a time");
const sameName = await call("/api/neighborhood/name-proposal", { token: hal.token, method: "POST", body: { name: "Pancake Row" } });
check(sameName.status === 400, "suggesting the current name is rejected");
const withdrawOther = await call("/api/neighborhood/name-proposal", { token: fay.token, method: "DELETE" });
check(withdrawOther.status === 403, "only the proposer can withdraw");
const yesNo = await call("/api/neighborhood/name-proposal/vote", { token: fay.token, method: "PUT", body: { yes: true } });
// Fay's yes makes 2 of 2 and passes immediately.
check(yesNo.data.name === "Waffle Way" && yesNo.data.nameProposal === null, "the deciding vote renames the street");
const noProposal = await call("/api/neighborhood/name-proposal/vote", { token: gus.token, method: "PUT", body: { yes: true } });
check(noProposal.status === 404, "voting with nothing open → 404");

// Taking a vote back, and withdrawing.
await call("/api/neighborhood/name-proposal", { token: hal.token, method: "POST", body: { name: "Syrup Street" } });
const take = await call("/api/neighborhood/name-proposal/vote", { token: hal.token, method: "PUT", body: { yes: false } });
check(take.data.nameProposal?.yesVotes === 0 && take.data.nameProposal?.votedByMe === false, "a vote can be taken back");
const withdraw = await call("/api/neighborhood/name-proposal", { token: hal.token, method: "DELETE" });
check(withdraw.status === 200 && withdraw.data.nameProposal === null && withdraw.data.name === "Waffle Way", "the proposer can withdraw");

// ---- matching only uses open streets ----
const ivy = await reg("ivy", { start: "match" });
const ivyStreet = await street(ivy);
check(ivy.me.wantsPrivate === false && ivyStreet.inviteOnly === false, "choosing to be matched means an open street");
check(ivy.me.neighborhoodId !== s.id, "a stranger is never matched onto an invite-only street");

// One member asking for invite only closes the whole street.
const ivyPrivate = await call("/api/me", { token: ivy.token, method: "PATCH", body: { wantsPrivate: true } });
check(ivyPrivate.data.wantsPrivate === true && (await street(ivy)).inviteOnly === true, "one member's toggle makes the street invite only");
const jo = await reg("jo", { start: "match" });
check(jo.me.neighborhoodId !== ivy.me.neighborhoodId && jo.me.neighborhoodId !== s.id, "matching skips the newly invite-only street");
const ivyOpen = await call("/api/me", { token: ivy.token, method: "PATCH", body: { wantsPrivate: false } });
check(ivyOpen.data.wantsPrivate === false, "the toggle turns back off");
const repeat = await call("/api/me", { token: ivy.token, method: "PATCH", body: { wantsPrivate: false } });
check(repeat.status === 200, "toggling to the same value is harmless");

// ---- moving ----
const toOwn = await call("/api/neighborhood/move", { token: gus.token, method: "POST", body: { start: "solo", inviteCode: s.inviteCode } });
check(toOwn.status === 400, "can't move to the street you already live on");
const badCode = await call("/api/neighborhood/move", { token: gus.token, method: "POST", body: { start: "solo", inviteCode: "nope-nope" } });
check(badCode.status === 400 && (await street(gus)).id === s.id, "a bad invite code leaves you where you were");
const toFriend = await call("/api/neighborhood/move", { token: jo.token, method: "POST", body: { start: "solo", inviteCode: s.inviteCode } });
check(toFriend.status === 200 && toFriend.data.neighborhood.id === s.id, "moving with an invite joins your friend's street");
const ivyAlone = (await street(ivy)).members.length === 1;
const left = await call("/api/neighborhood/move", { token: ivy.token, method: "POST", body: { start: "solo" } });
check(left.status === 200 && left.data.neighborhood.members.length === 1, "moving solo starts a new street");
// Matching may have put Ivy on a street left over from an earlier run. If she was alone,
// her old street is gone now (its invite code no longer works).
if (ivyAlone) {
  const ghost = await call("/api/neighborhood/move", { token: hal.token, method: "POST", body: { start: "solo", inviteCode: ivyStreet.inviteCode } });
  check(ghost.status === 400, "an emptied street is deleted");
}
const noBody = await call("/api/neighborhood/move", { token: hal.token, method: "POST" });
check(noBody.status === 400, "move needs a destination");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
