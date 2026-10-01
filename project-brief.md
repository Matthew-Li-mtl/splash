# Project Brief: Neighbors

## Concept
A creative outlet app positioned against endless-scroll social media. Low-learning-curve
creative tools (journaling, beat-making, writing, puzzles, two-player games) that are simple
enough to jump into instantly but deep enough for a serious user to build something real.

Social layer is intentionally capped: each user is assigned a fixed set of 10–20 interest-matched
"neighbors" — not a dynamic feed. The same people, indefinitely, unless the user manually
requests a reshuffle. The goal is a "walking around saying hi to your neighbors" feeling rather
than a feed algorithm — this favors relatability over social comparison (grounded in
self-determination theory).

## Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Node + Express + TypeScript
- **Database:** MongoDB
- **Realtime (v3):** Socket.io
- **Canvas (journal):** Fabric.js or Konva.js
- **Audio (beat maker):** Tone.js (built on Web Audio API)
- **Mobile path:** Web-first → PWA → Capacitor wrap → (React Native only if WebView perf becomes limiting)

## Repo structure (monorepo)
```
/apps
  /client      — React/Vite frontend
  /server      — Express backend
/packages
  /shared-types — TS types shared between client and server (User, Post, etc.)
```

## V1 Feature Scope
Keep v1 tight — proves the core loop (make → share → see a few others) without touching
real-time or audio complexity.

1. **Junk journal** — canvas-based scrapbook editor (images, text, doodles), stored as JSON
   element data, not flattened images.
2. **Writing prompts** — prompt library + simple text entry.
3. **One puzzle** — Sudoku (self-contained, client-side logic, no server dependency).
4. **Neighbors feed** — fixed set of 10–20 interest-matched users assigned at signup. Feed shows
   posts only from these users, sorted by recency. Neighbors never change automatically — only
   on manual user request ("get new neighbors").

### Deferred to later versions
- **V2:** Beat maker / launchpad (Tone.js) — isolated because it's the highest-complexity feature.
- **V3:** Two-player games (Sudoku-adjacent puzzles like Minesweeper can stay v1/v2; turn-based
  games need Socket.io infra, so bundle them together).

## Data Model (MongoDB)
```
users            { _id, username, interests: [tags], createdAt }

neighborhoods    { userId, neighborIds: [userId, ...], assignedAt }
                 // fixed until user manually requests a reshuffle — no auto-expiry, no cron job

posts            { _id, userId, type: 'journal' | 'beat' | 'writing' | 'puzzle',
                   content: {...}, tags: [interests], createdAt }

journalEntries   { postId, elements: [{ type, x, y, rotation, src/text, ... }] }

beats            { postId, bpm, grid: [[track, step, sampleId]], samplePackId }   // v2

prompts          { _id, text, category }

writingEntries   { postId, promptId, text }

puzzleStates     { postId, puzzleType, difficulty, state, solved }

gameSessions     { _id, players: [userId, userId], gameType, state, status, turn }  // v3
```

## API Routes (v1 scope)
```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/users/:id
PATCH  /api/users/:id/interests

POST   /api/posts                  — create post (journal | writing | puzzle)
GET    /api/posts/feed             — posts from user's fixed neighborIds, sorted by recency
GET    /api/posts/:id
DELETE /api/posts/:id

GET    /api/neighborhood           — get current user's neighbor list
POST   /api/neighborhood/assign    — initial assignment (called once at signup)
POST   /api/neighborhood/reshuffle — manual request for new neighbors (explicit user action only)

GET    /api/prompts                — writing prompt list
GET    /api/prompts/random

GET    /api/puzzles/sudoku/new     — generate a new puzzle
```

## Key architectural decisions worth keeping in mind
- **Decouple logic from DOM-specific code** now (canvas refs, audio context setup) — this is
  what keeps a future PWA/Capacitor/React-native path cheap.
- **Neighbors are a fixed, stored assignment, not a live query.** No auto-reshuffling, no cron
  jobs, no background matching — the feed just filters by a stored `neighborIds` list. Simpler
  to build and it's the actual point of the feature, not a cosmetic limit.
- **Store structured data, not rendered output** (journal elements as JSON, beat patterns as
  grid data) — keeps entries editable/remixable and storage cheap.

## Suggested build order
1. Scaffold monorepo (client + server + shared-types)
2. Auth + user model + interests
3. Sudoku puzzle (fully self-contained, good first win)
4. Writing prompts + entries
5. Journal editor (canvas)
6. Neighborhood assignment logic (interest-matching, run once at signup)
7. Feed + post model, filtered by fixed neighborIds
7. Ship v1, get real users
8. PWA support
9. Beat maker (v2)
10. Two-player games + Socket.io (v3)
11. Capacitor wrap if traction justifies app store presence
