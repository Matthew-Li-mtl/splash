# Deploying for free

One free **Render** web service runs the API *and* serves the web app. Data lives in your
free **MongoDB Atlas** M0 cluster. Total cost: $0.

## 1. Atlas: let the server in

1. Atlas → **Network Access** → **Add IP Address**.
   - For local development: **Add Current IP Address**.
   - For Render: **Allow access from anywhere** (`0.0.0.0/0`). Render's free tier has no fixed
     outgoing IP, so this is the standard setup. Your database is still protected by its username
     and password, so keep the password long and random.
2. Atlas → **Database Access**: if this password was ever pasted anywhere public (it used to sit in
   `.env.example`, which is normally committed), **edit the user and set a new password**, then
   update `MONGO_URI` everywhere.
3. Copy the connection string: **Database → Connect → Drivers**. Leave the database name out;
   `MONGO_DB` (default `splash`) picks it.

## 2. Put the code on GitHub

Make the `neighbors-zip` folder the root of the repo (that's where `package.json` and
`render.yaml` live):

```bash
cd neighbors-zip
git init -b main
git add .
git commit -m "Splash v1"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/splash.git
git push -u origin main
```

`.gitignore` already keeps `node_modules`, builds and `apps/server/.env` out of git.

## 3. Render

1. Sign in at [render.com](https://render.com) with GitHub (no credit card needed for free services).
2. **New → Blueprint** → pick the repo. Render reads `render.yaml`.
3. When asked, paste your Atlas connection string as `MONGO_URI`. `JWT_SECRET` is generated for you.
4. Deploy. You'll get a URL like `https://splash-abcd.onrender.com`. Open it and move in!

Every push to `main` redeploys automatically.

### What "free" means here

- **The server sleeps after ~15 minutes with no visitors.** The next visit takes 30–60 seconds
  while it wakes up. The app shows a friendly "Waking up the neighborhood…" screen instead of
  failing. The mobile app's UI loads instantly from the phone, and only data waits.
- Free accounts get 750 instance-hours per month, enough to keep one service up all month.

### Keeping it awake (optional)

`.github/workflows/keep-awake.yml` pings `/api/health` every 10 minutes so the server never
naps. It does nothing until you turn it on:

**GitHub → your repo → Settings → Secrets and variables → Actions → Variables → New repository
variable**: `APP_URL` = `https://splash-abcd.onrender.com`

Check it from the **Actions** tab ("Keep awake" → **Run workflow** runs it immediately). To turn it
off, delete the variable or disable the workflow there.

- **Public repo:** GitHub Actions minutes are free and unlimited.
- **Private repo:** you get 2,000 free minutes a month, and every ping counts as a minute.
  Every 10 minutes is ~4,300 runs, so it would run out mid-month. Either change the cron line to
  something like `*/14 7-23 * * *` (every 14 minutes from 7:00 to 23:59 UTC, about 1,600 runs),
  or skip the workflow and use [cron-job.org](https://cron-job.org) (free, no limits): create a
  job that GETs the same URL every 10 minutes.
- GitHub sometimes starts scheduled jobs late, so the odd wake-up delay can still happen.
  cron-job.org is more punctual if that matters.
- No websockets are needed: chat and games use light polling, so nothing breaks while asleep.

## Staying inside Atlas's free 512 MB

Text, songs, puzzles and game boards are tiny (a song is a few hundred bytes). **Photos are what
use space.** They're resized in the browser to roughly 100–250 KB each, and each person has a 15 MB
photo allowance (`ASSET_QUOTA_MB`). Rough budget: ~2,500–3,000 photos, or a few hundred active
collage makers. Check usage in Atlas → **Database → Collections** (look at `assets`).

When you outgrow it, move photo storage to Cloudflare R2 (10 GB free) or similar. Only
`apps/server/src/routes/assets.ts` needs to change, since posts reference images by id.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Render + `apps/server/.env` | Atlas connection string |
| `MONGO_DB` | optional | Database name (default `splash`) |
| `JWT_SECRET` | Render (auto) + `.env` | Signs login tokens. Changing it signs everyone out |
| `NODE_ENV` | Render | `production` makes missing secrets a startup error |
| `CLIENT_ORIGINS` | optional | Extra web origins allowed to call the API (only if you host the web app elsewhere) |
| `ASSET_QUOTA_MB` | optional | Per-person photo allowance (default 15) |
