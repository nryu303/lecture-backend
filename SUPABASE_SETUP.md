# Supabase Setup (MongoDB → Supabase/Postgres migration)

This backend has been migrated from MongoDB/Mongoose to **Supabase (PostgreSQL)**.
Follow these steps to get a database and run the app.

## 1. Create a Supabase project (free)

1. Go to <https://supabase.com> and sign in (GitHub login works).
2. Click **New project**.
   - **Name**: e.g. `lecture-backend`
   - **Database password**: choose a strong one (you won't need it for this app, but save it).
   - **Region**: pick the one closest to you.
3. Wait ~2 minutes for the project to finish provisioning.

## 2. Get your credentials

In the Supabase dashboard for your project:

1. Click the gear icon → **Project Settings** → **API**.
2. Copy these two values:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **`service_role` secret key** (under "Project API keys" — the **secret** one, *not* `anon`).
     > ⚠️ The `service_role` key bypasses Row Level Security. It is a server-side secret —
     > never expose it to a browser/frontend. This backend is server-side, so it's the right key.

## 3. Put credentials in `.env`

Open [.env](.env) and fill in:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

## 4. Create the database schema

1. In the Supabase dashboard, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open [supabase/schema.sql](supabase/schema.sql) from this repo, copy the **entire** contents,
   paste into the SQL editor, and click **Run**.
4. You should see "Success. No rows returned." This creates all 16 tables, indexes, and the
   `updated_at` trigger.

## 5. Install dependencies & run

```bash
npm install
npm run dev
```

On first start the server will automatically create the **default admin user** (from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`, or the built-in defaults).

You should see:

```
Connecting to Supabase...
Supabase connected successfully
Default admin user created
Server running on 0.0.0.0:4000
```

## Notes

- The data layer uses a thin Mongoose-compatible adapter (`src/db/adapter.js`) on top of
  `@supabase/supabase-js`, so the existing controllers/queries keep working.
- Nested document fields (e.g. `videoProgress`, `options`, `answers`, `faceDescriptor`,
  `metadata`) are stored as `jsonb` columns.
- Primary keys are `uuid` (exposed to app code as both `id` and `_id`).
- If you change the schema, edit `supabase/schema.sql` and re-run the changed statements.
