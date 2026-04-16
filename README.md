# Garnet Backend

This repo is set up so you can run the backend from the **top-level project folder**.

## Run The Backend

From the repo root:

```bash
npm install
npm run start:dev
```

The app will start through the root wrapper package and run the actual NestJS backend inside the nested `garnetbe-backup-main` folder.

## Required Environment Variables

Before running, create:

```txt
garnetbe-backup-main/.env.local
```

Inside it, add:

```env
NODE_ENV=development
PORT=3000
ENABLE_SWAGGER=true

SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres
SUPABASE_PASSWORD_RESET_REDIRECT_URL=pakiship://reset-password

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081,http://localhost:19006
```

## Full Setup

```bash
git clone <repo-url>
cd garnetbe-backup-main
npm install
npm run start:dev
```

## Health Check

When the backend is running, test:

```txt
http://localhost:3000/api/v1/health
```

If testing from a real phone on the same Wi-Fi, use your computer's local IP instead of `localhost`.

Example:

```txt
http://192.168.5.31:3000/api/v1/health
```

## Notes

- Run commands from the **repo root**, not the nested backend folder.
- `SUPABASE_SERVICE_ROLE_KEY` is backend-only and must never be exposed in frontend code.
- If port `3000` is already in use, stop the older backend process before starting again.
