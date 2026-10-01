# Splash: notes for working on this codebase

Splash: a low-barrier creative outlet (easy tools to make something on a whim), shared within a fixed neighborhood of ≤21 people. Creating is the core; the neighborhood is the social layer around it.
TypeScript monorepo (npm workspaces). Web-first; the mobile app is the same build via Capacitor.

## Hard constraints

- **Free tiers:** Atlas M0 (512 MB), one Render free web service that sleeps when idle.
  So: no websockets (poll with TanStack Query `refetchInterval`), no background jobs/cron,
  store structured content (not rendered images), photos compressed client-side + per-user quota.
- **One codebase for web + mobile.** Don't add web-only assumptions: API calls go through
  `apiUrl()` (absolute in mobile builds), auth is a bearer token (no cookies), use CSS safe-area vars.
- Neighborhood = group with `NEIGHBORHOOD_CAPACITY` (21). Membership is `User.neighborhoodId`;
  `Neighborhood.memberCount`/`interestCounts` are denormalized. Feed = posts by current members.

## Layout

```
packages/shared/src   constants.ts (interests, reactions, avatars) · content.ts (post content
                      types per kind) · api.ts (DTOs) · games/ (pure rules: initial() + play())
apps/server/src       index.ts (boot) · app.ts (middleware, routes, static hosting)
                      config.ts (env; loads apps/server/.env, real env wins) · auth.ts (JWT)
                      http.ts (HttpError, currentUser, errorHandler) · validation.ts (zod)
                      serialize.ts (DTO mappers) · services/ (neighborhood assignment, access)
                      models/ (Mongoose) · routes/ (one router per resource)
apps/client/src       App.tsx (routes, lazy tools) · lib/ (api, auth, queries, util, image,
                      toast, useHistory) · components/ · pages/ · tools/ · games/
                      styles.css (design tokens + shared classes; tools have their own .css)
apps/client/android, ios   Generated Capacitor projects (commit them; don't hand-edit web assets)
```

## Conventions

- Express 5: async handlers just `throw` (`badRequest()`, `notFound()`, `HttpError`); no try/catch.
  Validate bodies with zod `.parse()`. Zod errors become 400s automatically.
- Server routes return DTOs from `serialize.ts`. Never return Mongoose docs directly.
- Client data access lives in `lib/queries.ts` (query keys in `qk`). Mutations invalidate there.
- UI copy is warm and encouraging; the feed ends deliberately ("all caught up"). Avoid
  engagement-maximizing patterns (infinite scroll, streak pressure, public like counts as goals).
- Styling: CSS classes + tokens in `styles.css` (`--c-write`, `--c-collage`, … per tool).
  No CSS framework. Icons: `lucide-react` (v1 names, e.g. `House`, `Trash`, not `Home`/`Trash2`).

## Add a creative tool (new post kind)

1. `packages/shared/src/content.ts`: content interface, add to `PostKind`, `POST_KINDS`, `PostContentMap`.
2. `apps/server/src/validation.ts`: zod schema in `contentSchemas`.
3. `apps/client/src/tools/<tool>/`: `XEditor.tsx` (default export; use `useEditorSource`,
   `ToolHeader`, `ShareSheet`, `useLocalState` draft) and `XView.tsx` (default export, `ViewerProps`).
4. Register in `tools/registry.ts` (`TOOLS` + `VIEWERS`) and add the route in `App.tsx`.

## Add a two-player game

1. `packages/shared/src/games/<game>.ts`: implement `GameRules` (validate `move` shape in `play`).
2. Register in `games/index.ts` `GAMES`.
3. Add a board component to `apps/client/src/games/boards.tsx` `BOARDS` (+ `scoreOf` if scored).
   The server, game list, challenge sheet and optimistic moves pick it up automatically.

## Commands

`npm run dev` · `npm run build` · `npm start` · `npm run typecheck` ·
`npm run smoke -- http://localhost:4000` (writes test data; dev DB only) · `npm run mobile:sync`

Local testing without Atlas: point `MONGO_URI` at any MongoDB (e.g. `mongodb-memory-server`).
TypeScript is v7 (native compiler); tsconfigs use `moduleResolution: bundler` and explicit `types`.
