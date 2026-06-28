# Deploying the backend to Railway

Your frontend is on Vercel (HTTPS), so the backend needs a public **HTTPS** URL.
Railway provides that automatically. Follow these steps in order.

> Prefer Render instead? A [render.yaml](render.yaml) blueprint is also included;
> the steps are equivalent (set the same env vars in the Render dashboard).

---

## ⚠️ STEP 0 — Rotate leaked secrets FIRST (important)

`.env` was previously committed and pushed to GitHub, exposing your Supabase key
and `JWT_SECRET`. You've already switched `SUPABASE_SERVICE_ROLE_KEY` to a new
`sb_secret_…` key — good. Still do these:

1. **Disable the legacy Supabase keys** so the leaked `eyJ…` key stops working:
   Supabase Dashboard → Project Settings → **API Keys** (or **JWT Keys**) →
   disable/rotate the **legacy** API keys.
2. **JWT_SECRET**: it's still `secret`. Replace it with a long random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Put the result in `.env` (local) and in Railway (below). Never commit it.

---

## STEP 1 — Commit & push the deployment changes

`.env` is now git-ignored and untracked. Commit and push:

```bash
git add -A
git commit -m "chore: prep for Railway deploy (gitignore .env, railway.json, health check)"
git push origin main
```

---

## STEP 2 — Create the Railway service

1. Go to <https://railway.app> and sign up / log in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `nryu303/lecture-backend`.
4. Railway auto-detects Node (Nixpacks) and reads [railway.json](railway.json)
   for the start command (`node src/index.js`) and health check (`/health`).

## STEP 3 — Set environment variables

In the service → **Variables** tab, add these (use your rotated values).
Do **not** set `PORT` — Railway injects it and the app reads `process.env.PORT`.

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `SUPABASE_URL` | `https://hhactuduxlxevzomoxdn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_…` key |
| `JWT_SECRET` | the new random string from Step 0 |
| `JWT_EXPIRES_IN` | `1d` |
| `ADMIN_EMAIL` | `simonfinch@gmail.com` (or your choice) |
| `ADMIN_PASSWORD` | a strong password |
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` / `EMAIL_PASSWORD` | your SMTP creds (optional) |
| `PROD_CORS_ORIGIN` | `https://manabou.co.jp,https://www.manabou.co.jp` |
| `STRIPE_WEBHOOK_SECRET` | your Stripe webhook secret (optional) |

## STEP 4 — Expose a public URL

1. Service → **Settings** → **Networking** → **Generate Domain**.
   Railway gives you something like `https://lecture-backend-production.up.railway.app`.

## STEP 5 — Verify

1. Health: open `https://<your-app>.up.railway.app/health` → `{"status":"ok"}`.
2. Login:
   ```bash
   curl -X POST https://<your-app>.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"id":"simonfinch@gmail.com","password":"YOUR_ADMIN_PASSWORD"}'
   ```
   Expect `{"success":true,...,"token":"..."}`.

## STEP 6 — Point the Vercel frontend at the backend

1. In the **frontend** Vercel project → Settings → **Environment Variables**,
   set the API base URL (commonly `VITE_API_URL`) to your Railway URL, e.g.
   `https://<your-app>.up.railway.app`.
2. **Redeploy** the frontend on Vercel.
3. CORS is already handled: the backend allows any `*.vercel.app` origin
   (see [src/index.js](src/index.js)).

---

## Notes & caveats

- **No free tier**: Railway gives a one-time trial credit, then requires a plan
  (~$5/mo minimum). No idle sleeping, so no cold starts.
- **File uploads are ephemeral**: this app saves uploads to `public/uploads` on
  the container's local disk, which resets on every deploy/restart. For persistent
  uploads, attach a Railway **Volume** (mount it at `public/uploads`) or move
  uploads to **Supabase Storage**. I can help wire either up.
- **Database**: already on Supabase; `supabase/schema.sql` has been run
  (the admin user exists).
