// API smoke test: registers a few throwaway users and exercises every route.
// Run against a DEV server/database only (it writes data):  npm run smoke -- http://localhost:4000
const BASE = process.argv[2] ?? "http://localhost:4000";
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

async function call(path, { token, cookie, method = "GET", body, raw, type } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (raw) headers["Content-Type"] = type;
  const res = await fetch(BASE + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  const setCookie = res.headers.get("set-cookie") ?? "";
  // The refresh cookie as a Cookie header value ("splash_rt=…"), if the response set one.
  const rt = /splash_rt=([^;]*)/.exec(setCookie)?.[1];
  return { status: res.status, data, headers: res.headers, setCookie, cookie: rt ? `splash_rt=${rt}` : null };
}

const refresh = (cookie) => call("/api/auth/refresh", { method: "POST", body: {}, cookie });

const suffix = Date.now().toString(36).slice(-5);
const reg = (name, interests, inviteCode) =>
  call("/api/auth/register", {
    method: "POST",
    body: { username: `${name}_${suffix}`, displayName: name, password: "password123", avatar: { emoji: "🦊", color: "#f4a261" }, interests, inviteCode },
  });

const health = await call("/api/health");
check(health.status === 200 && health.data.db === "connected", "health ok + db connected");

const a = await reg("alice", ["music", "writing"]);
check(a.status === 201 && a.data.accessToken && a.data.expiresIn === 900, "register alice (15-minute access token)");
const b = await reg("bob", ["music"]);
const c = await reg("cara", ["puzzles"]);
check(b.status === 201 && c.status === 201, "register bob, cara");
let A = a.data.accessToken;
const B = b.data.accessToken, C = c.data.accessToken;

const dup = await reg("alice", []);
check(dup.status === 409, "duplicate username rejected");
const badPw = await call("/api/auth/register", { method: "POST", body: { username: "zz_" + suffix, displayName: "z", password: "short", avatar: { emoji: "x", color: "#ffffff" } } });
check(badPw.status === 400 && /8 characters/.test(badPw.data.error), "short password rejected: " + badPw.data?.error);

const login = await call("/api/auth/login", { method: "POST", body: { username: `ALICE_${suffix}`, password: "password123" } });
check(login.status === 200, "login (case-insensitive)");
const badLogin = await call("/api/auth/login", { method: "POST", body: { username: `alice_${suffix}`, password: "nope" } });
check(badLogin.status === 401, "wrong password rejected");

const noAuth = await call("/api/me");
check(noAuth.status === 401, "me requires auth");

// ---- sessions: refresh cookie, rotation, revocation ----
check(/HttpOnly/i.test(a.setCookie) && /SameSite=Strict/i.test(a.setCookie) && /Path=\/api\/auth/i.test(a.setCookie), "refresh cookie is HttpOnly, SameSite=Strict, scoped to /api/auth");
check(!("token" in a.data) && !JSON.stringify(a.data).includes(a.cookie.split("=")[1]), "refresh token never appears in the JSON body");
const noJson = await call("/api/auth/refresh", { method: "POST", cookie: a.cookie, raw: "x", type: "text/plain" });
check(noJson.status === 415, "refresh requires a JSON body (CSRF layer)");
const noCookie = await refresh(undefined);
check(noCookie.status === 401, "refresh without cookie → 401");
const r1 = await refresh(a.cookie);
check(r1.status === 200 && r1.data.accessToken && r1.cookie && r1.cookie !== a.cookie, "refresh rotates the cookie and returns a new access token");
check(r1.data.user?.displayName === "alice", "refresh returns the user (no extra /me call on page load)");
const race = await refresh(a.cookie);
check(race.status === 401 && race.data.code === "refresh_retry", "reusing the just-rotated token inside the grace window → refresh_retry (two-tab race)");
const r2 = await refresh(r1.cookie);
check(r2.status === 200, "the rotated token keeps working after a harmless race");
const garbage = await refresh("splash_rt=not-a-real-token");
check(garbage.status === 401 && garbage.data.code === "session_ended", "unknown refresh token → 401 session_ended");
A = r2.data.accessToken;

const forged = await call("/api/me", { token: A.slice(0, -4) + "AAAA" });
check(forged.status === 401, "tampered access token rejected");
const sess = await call("/api/me/sessions", { token: A });
check(sess.status === 200 && sess.data.length >= 2 && sess.data.filter((x) => x.current).length === 1, `sessions list (${sess.data.length} devices, one marked current)`);
// The login above created a second alice session; sign that device out remotely.
const other = sess.data.find((x) => !x.current);
const delOther = await call(`/api/me/sessions/${other.id}`, { method: "DELETE", token: A });
const otherRefresh = await refresh(login.cookie);
check(delOther.status === 204 && otherRefresh.status === 401, "signing out another device kills its refresh token");

// A throwaway user for logout / password change / sign out everywhere.
const z = await reg("zed", []);
const zLogout = await call("/api/auth/logout", { method: "POST", body: {}, cookie: z.cookie });
const zAfter = await refresh(z.cookie);
check(zLogout.status === 204 && zAfter.status === 401, "logout ends the session");
const zedLogin = () => call("/api/auth/login", { method: "POST", body: { username: `zed_${suffix}`, password: "password123" } });
const z2 = await zedLogin();
const z3 = await zedLogin();
const pw = await call("/api/me/password", { method: "POST", token: z2.data.accessToken, body: { current: "password123", next: "password456" } });
check(pw.status === 200 && pw.data.accessToken && pw.cookie, "password change returns a fresh session for this device");
const oldAccess = await call("/api/me", { token: z3.data.accessToken });
check(oldAccess.status === 401 && oldAccess.data.code === "token_revoked", "password change instantly revokes other access tokens");
const oldRefresh = await refresh(z3.cookie);
check(oldRefresh.status === 401, "password change signs out other devices");
const newMe = await call("/api/me", { token: pw.data.accessToken });
check(newMe.status === 200, "the new session after a password change works");
const all = await call("/api/auth/logout-all", { method: "POST", body: {}, token: pw.data.accessToken, cookie: pw.cookie });
const afterAll = await call("/api/me", { token: pw.data.accessToken });
check(all.status === 204 && afterAll.status === 401, "sign out everywhere revokes the current access token immediately");
if (process.env.SMOKE_SLOW) {
  // Replaying a rotated token after the 30 s grace window means it was copied: revoke the session.
  const t = await reg("tess", []);
  const t1 = await refresh(t.cookie);
  await new Promise((r) => setTimeout(r, 31_000));
  const replay = await refresh(t.cookie);
  const legit = await refresh(t1.cookie);
  check(replay.status === 401 && legit.status === 401, "replaying an old refresh token revokes the whole session (theft detection)");
}

const hood = await call("/api/neighborhood", { token: A });
check(hood.status === 200 && hood.data.members.length >= 3, `neighborhood ${hood.data.name} has ${hood.data.members.length} members`);
const ids = Object.fromEntries(hood.data.members.map((m) => [m.displayName, m.id]));

// invite code
const d = await reg("dev", [], hood.data.inviteCode);
check(d.status === 201 && d.data.user.neighborhoodId === hood.data.id, "invite code joins that neighborhood");
const badInvite = await reg("eve", [], "nope-nope");
check(badInvite.status === 400, "bad invite rejected");

// posts
const writing = await call("/api/posts", { token: A, method: "POST", body: { kind: "writing", title: "Hello", content: { text: "First post!", prompt: "Say hi", extra: "strip me" }, visibility: "neighbors" } });
check(writing.status === 201 && writing.data.content.extra === undefined, "create writing post (unknown keys stripped)");
const priv = await call("/api/posts", { token: A, method: "POST", body: { kind: "writing", content: { text: "secret" }, visibility: "private" } });
check(priv.status === 201, "create private post");
const song = await call("/api/posts", { token: B, method: "POST", body: { kind: "song", title: "Tune", visibility: "neighbors", content: { bpm: 110, bars: 2, stepsPerBeat: 2, scale: "pentatonic", root: 0, melody: { instrument: "marimba", notes: [[0, 3], [2, 5]] }, bass: { instrument: "pluck", notes: [] }, drums: { notes: [[0, 0]] } } } });
check(song.status === 201, "create song post");
const badSong = await call("/api/posts", { token: B, method: "POST", body: { kind: "song", content: { bpm: 9999 }, visibility: "neighbors" } });
check(badSong.status === 400, "invalid song rejected: " + badSong.data?.error);
const puzzle = await call("/api/posts", { token: C, method: "POST", body: { kind: "puzzle", content: { game: "sudoku", difficulty: "easy", seed: "daily-2026-09-30", timeMs: 300000, daily: "2026-09-30" }, visibility: "neighbors" } });
check(puzzle.status === 201, "create puzzle post");

const feedB = await call("/api/posts/feed", { token: B });
check(feedB.status === 200 && feedB.data.posts.length === 3, `bob's feed has 3 posts (got ${feedB.data.posts?.length})`);
check(!feedB.data.posts.some((p) => p.content.text === "secret"), "private post hidden from feed");
const privB = await call(`/api/posts/${priv.data.id}`, { token: B });
check(privB.status === 404, "private post not viewable by neighbor");
const alicePostsAsSelf = await call(`/api/posts?author=${ids.alice}`, { token: A });
check(alicePostsAsSelf.data.posts.length === 2, "author sees own private posts");
const alicePostsAsBob = await call(`/api/posts?author=${ids.alice}`, { token: B });
check(alicePostsAsBob.data.posts.length === 1, "neighbor sees only shared posts");

const react1 = await call(`/api/posts/${writing.data.id}/reactions`, { token: B, method: "PUT", body: { emoji: "❤️" } });
check(react1.data.reactions[0]?.userIds.includes(ids.bob), "reaction added");
const react2 = await call(`/api/posts/${writing.data.id}/reactions`, { token: B, method: "PUT", body: { emoji: "❤️" } });
check(react2.data.reactions.length === 0, "reaction toggled off");
const comment = await call(`/api/posts/${writing.data.id}/comments`, { token: C, method: "POST", body: { text: "Welcome!" } });
check(comment.status === 201, "comment added");
const postAfter = await call(`/api/posts/${writing.data.id}`, { token: A });
check(postAfter.data.commentCount === 1, "comment count = 1");
const editByOther = await call(`/api/posts/${writing.data.id}`, { token: B, method: "PATCH", body: { title: "hacked" } });
check(editByOther.status === 403, "non-author cannot edit");
const edit = await call(`/api/posts/${writing.data.id}`, { token: A, method: "PATCH", body: { title: "Hello again" } });
check(edit.data.title === "Hello again", "author can edit");
const remix = await call("/api/posts", { token: A, method: "POST", body: { kind: "song", content: song.data.content, visibility: "neighbors", remixOf: song.data.id } });
check(remix.status === 201 && remix.data.remixOf?.author?.displayName === "bob", "remix links to source author");

// messages
const threadsA = await call("/api/messages/threads", { token: A });
const porch = threadsA.data[0]?.channel;
check(threadsA.status === 200 && threadsA.data[0]?.kind === "neighborhood", "porch thread listed");
await call(`/api/messages/${porch}`, { token: B, method: "POST", body: { text: "Hi porch" } });
const dm = `dm_${[ids.alice, ids.bob].sort().join("_")}`;
const dmSend = await call(`/api/messages/${dm}`, { token: A, method: "POST", body: { text: "hey bob" } });
check(dmSend.status === 201, "DM sent");
const dmSnoop = await call(`/api/messages/${dm}`, { token: C });
check(dmSnoop.status === 403, "third party can't read DM");
const badgesB = await call("/api/me/badges", { token: B });
check(badgesB.data.unreadThreads === 1, `bob has 1 unread thread (DM) (got ${badgesB.data.unreadThreads})`);
const threadsB = await call("/api/messages/threads", { token: B });
check(threadsB.data.length === 2 && threadsB.data[1].other?.displayName === "alice", "bob sees porch + DM with alice");
await call(`/api/messages/${dm}/read`, { token: B, method: "POST" });
const badgesB2 = await call("/api/me/badges", { token: B });
check(badgesB2.data.unreadThreads === 0, "marked read");
const msgs = await call(`/api/messages/${porch}`, { token: A });
check(msgs.data.length === 1 && msgs.data[0].text === "Hi porch", "porch messages listed");

// games
const g = await call("/api/games", { token: A, method: "POST", body: { type: "fourInARow", opponentId: ids.bob } });
check(g.status === 201 && g.data.you === 0, "challenge bob to Four in a Row");
const outOfTurn = await call(`/api/games/${g.data.id}/move`, { token: B, method: "POST", body: { move: { col: 0 }, moveCount: 0 } });
check(outOfTurn.status === 400, "out-of-turn move rejected");
let mc = 0;
const play = async (tok, col) => {
  const r = await call(`/api/games/${g.data.id}/move`, { token: tok, method: "POST", body: { move: { col }, moveCount: mc } });
  if (r.status === 200) mc = r.data.moveCount;
  return r;
};
await play(A, 0); await play(B, 1); await play(A, 0); await play(B, 1); await play(A, 0); await play(B, 1);
const win = await play(A, 0);
check(win.data.status === "finished" && win.data.state.winner === 0, "alice wins with a vertical four");
const stale = await call(`/api/games/${g.data.id}/move`, { token: B, method: "POST", body: { move: { col: 2 }, moveCount: 0 } });
check(stale.status === 400 || stale.status === 409, "move after finish rejected");
const dots = await call("/api/games", { token: B, method: "POST", body: { type: "dotsAndBoxes", opponentId: ids.cara } });
check(dots.status === 201, "dots game created");
const badgesC = await call("/api/me/badges", { token: C });
check(badgesC.data.yourTurn === 0, "cara: not her turn yet");
await call(`/api/games/${dots.data.id}/move`, { token: B, method: "POST", body: { move: { kind: "h", r: 0, c: 0 }, moveCount: 0 } });
const badgesC2 = await call("/api/me/badges", { token: C });
check(badgesC2.data.yourTurn === 1, "cara: her turn now");
const resign = await call(`/api/games/${dots.data.id}/resign`, { token: C, method: "POST" });
check(resign.data.status === "finished" && resign.data.state.winner === 0 && resign.data.resignedBy === 1, "resign works");
const mancala = await call("/api/games", { token: A, method: "POST", body: { type: "mancala", opponentId: ids.cara } });
const m1 = await call(`/api/games/${mancala.data.id}/move`, { token: A, method: "POST", body: { move: { pit: 2 }, moveCount: 0 } });
check(m1.data.state.turn === 0 && m1.data.state.note === "Extra turn!", "mancala: landing in store = extra turn");
const list = await call("/api/games", { token: A });
check(list.data.length === 2 && list.data[0].type === "mancala", "games list, your turn first");

// assets
const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const up = await call("/api/assets", { token: A, method: "POST", raw: png, type: "image/png" });
check(up.status === 201 && up.data.id, "upload image");
const got = await fetch(`${BASE}/api/assets/${up.data.id}`);
check(got.status === 200 && got.headers.get("content-type") === "image/png", "fetch image publicly");
const fake = await call("/api/assets", { token: A, method: "POST", raw: Buffer.from("not an image at all"), type: "image/png" });
check(fake.status === 400, "non-image rejected");

// profiles and moving
const prof = await call(`/api/users/bob_${suffix}`, { token: A });
check(prof.status === 200 && prof.data.displayName === "bob", "view neighbor profile");
const me = await call("/api/me", { token: C, method: "PATCH", body: { bio: "hi!", interests: ["puzzles", "music"] } });
check(me.data.bio === "hi!" && me.data.interests.length === 2, "update profile");
const move = await call("/api/neighborhood/move", { token: C, method: "POST" });
check(move.status === 200 && move.data.neighborhood.id !== hood.data.id, "cara moved to a new neighborhood");
const moveAgain = await call("/api/neighborhood/move", { token: C, method: "POST" });
check(moveAgain.status === 429, "move cooldown enforced");
const feedAfterMove = await call("/api/posts/feed", { token: B });
check(!feedAfterMove.data.posts.some((p) => p.author.displayName === "cara"), "moved neighbor's posts leave the feed");
const dmToCara = await call(`/api/messages/dm_${[ids.alice, ids.cara].sort().join("_")}`, { token: A, method: "POST", body: { text: "hi" } });
check(dmToCara.status === 403, "can't DM a former neighbor");

const notFoundApi = await call("/api/nope", { token: A });
check(notFoundApi.status === 404, "unknown API route 404s as JSON");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
