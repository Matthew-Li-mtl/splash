# Splash

Make small things. Share them with 20 neighbors. That's it.

Splash is a low-barrier creative outlet: hop in and make something. It is also a small, finite alternative to endless feeds. Everyone is placed in a **neighborhood** of up
to 21 people (you + 20 neighbors), matched by interests. You make things with easy creative
tools, share them with your street, react, reply, chat on the porch, and play turn-based games
with neighbors. The feed ends ("You're all caught up 🌙").

## What's in v1

| Area | Features |
| --- | --- |
| **Write** | Daily prompt (same for everyone), 60+ prompts, challenges with live checks (six-word story, 50/100 words, haiku, no letter E, acrostic, one long sentence), sprint timer, autosaved drafts |
| **Collage** | Photos (compressed client-side), text in 4 fonts, stickers, washi tape / paper scraps / shapes, freehand drawing, 11 paper backgrounds, drag + one-handle spin/resize, layers, undo/redo |
| **Song maker** | Chrome-Music-Lab-style grid with melody, bass and drums; 5 scales (pentatonic by default, so nothing sounds wrong), 8 synthesized instruments, live playback, "Give me a beat" starter |
| **Puzzles** | Seeded Sudoku (daily puzzle shared by the street, notes, hints) and Minesweeper; share your time, neighbors can play the exact same board |
| **Games** | Async Four in a Row, Dots & Boxes, Mancala with neighbors, with rules shared by client and server |
| **Social** | Neighborhood feed, reactions, replies, private drafts ("only you"), edit and remix, porch group chat, DMs, profiles, invite codes, a rare "move neighborhoods" option (30-day cooldown) |

## Stack

TypeScript everywhere · React 19 + Vite 8 + React Router + TanStack Query · Express 5 + Mongoose 9
· MongoDB Atlas (free M0) · Capacitor 8 for iOS/Android · deploys as **one free Render service**.

```
apps/client        React web app (also the mobile app, via Capacitor: android/, ios/)
apps/server        Express API; in production it also serves the built web app
packages/shared    Types, post content shapes, and the two-player game rules
docs/              DEPLOY.md (free hosting), MOBILE.md (phones)
scripts/           smoke-api.mjs: end-to-end API check
```

## Run it locally

```bash
npm install
cp apps/server/.env.example apps/server/.env   # then fill in MONGO_URI and JWT_SECRET
npm run dev                                    # API on :4000, web app on http://localhost:5173
```

`apps/server/.env` is gitignored. Atlas must allow your IP: **Atlas → Network Access → Add IP Address**.

Other commands:

```bash
npm run build       # build web app + server bundle
npm start           # run the production build (serves the web app at http://localhost:4000)
npm run typecheck   # TypeScript across all packages
npm run smoke -- http://localhost:4000   # API regression check. Writes test users, so use a dev DB
npm run mobile:android                   # build + open Android Studio (see docs/MOBILE.md)
```

## Next steps

- **Deploy for free:** [docs/DEPLOY.md](docs/DEPLOY.md)
- **Put it on phones:** [docs/MOBILE.md](docs/MOBILE.md)
- **Working on the code (or with Claude):** [CLAUDE.md](CLAUDE.md) explains the architecture and how to add a tool or a game.

`project-brief.md` is the original vision doc. This README reflects what's actually built.
