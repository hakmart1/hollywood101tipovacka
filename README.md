# Hollywood 101 Tipovačka

A small Czech movie box-office guessing game. Players guess the opening box-office
revenue of the movies in a weekly *contest* (a "round"), earn a play-money currency
called **ImfCoins** based on how close their guesses are, and compete on a leaderboard.
The UI is in Czech.

## Stack

Runs entirely on Cloudflare's free tier:

- **Frontend** — React 18 + TypeScript, built with Vite. Single-page app with hash
  routing (see `readRoute()` in `src/App.tsx`). Output goes to `dist/`.
- **Backend API** — Cloudflare **Pages Functions** under `functions/api/**`. File-based
  routing: `functions/api/foo/bar.ts` → `/api/foo/bar`. Shared helpers live in
  `functions/_lib/`.
- **Database** — Cloudflare **D1** (SQLite). Binding name `DB`, configured in
  `wrangler.toml`.
- **Cron worker** — a separate Worker in `worker/` that auto-evaluates contests when
  their scheduled evaluation time arrives (runs every 5 minutes). Deployed
  independently but bound to the **same** D1 database, and reuses the Pages app's
  evaluation logic (`functions/_lib/evaluate.ts`).

## Project layout

```
src/                      React SPA (pages, components, styles)
functions/
  _lib/                   Shared backend helpers (auth, session, email, scoring, evaluate, ...)
  api/                    Pages Functions endpoints (file-based routing)
db/migrations/            D1 migrations (forward-only)
worker/                   Standalone cron worker (its own wrangler.toml)
wrangler.toml             Pages project config + D1 binding
```

### Domain terminology

- A **round** (DB table `rounds`, admin UI) is a **contest** ("tipovačka") in the
  public API (`/api/contests`). Same thing, two names.
- Each round has several **movies**; players place **guesses** on each movie's revenue.
- `imf_coin_history` is the append-only ledger of every ImfCoins change; a user's
  balance is `users.imf_coins_balance`, and `rank`/`previous_rank`/`rank_balance` are
  frozen at evaluation for the leaderboard.

## Database

Tables (see `db/migrations/0001_initial_schema.sql`): `users`, `user_auth_identities`,
`activation_codes`, `rounds`, `movies`, `guesses`, `imf_coin_history`, `faq_entries`.
(`faq_entries` exists but is currently unused by the UI.)

Migrations are **forward-only** and tracked in the `d1_migrations` table inside the
database (Wrangler tracks by file name, not content).

```bash
# create a new migration
npx wrangler d1 migrations create hollywood101tipovacka <name>

# apply locally / to production
npx wrangler d1 migrations apply hollywood101tipovacka --local
npx wrangler d1 migrations apply hollywood101tipovacka --remote

# inspect production
npx wrangler d1 execute hollywood101tipovacka --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

`0001_initial_schema.sql` is a consolidated baseline (the original 0001–0020 history was
squashed). **Do not edit an applied migration** — add a new `000N_*.sql` file instead.
Never put `DROP TABLE` at the top of a migration (D1 runs migrations in a transaction
where `PRAGMA foreign_keys=OFF` is ignored, so a drop can cascade).

## Local development

```bash
yarn install

# terminal 1 — Pages Functions backend + local D1 on :8788
yarn dev:api           # wrangler pages dev dist (needs `yarn build` once first)

# terminal 2 — Vite dev server with HMR, proxies /api to :8788
yarn dev
```

Create a local D1 copy with `npx wrangler d1 migrations apply hollywood101tipovacka --local`.
`yarn dev:api` injects a throwaway `SESSION_SECRET=local-dev-secret`.

Type-check and build:

```bash
npx tsc --noEmit -p tsconfig.json
yarn build
```

## Deployment

The Pages project is **git-connected**: pushing to `main` triggers an automatic build
and deploy (build command `yarn build`, output `dist`). No manual deploy step for the
web app.

The cron worker is **not** part of the Pages deploy — deploy it separately whenever
`worker/` or its shared deps change:

```bash
npx wrangler deploy --config worker/wrangler.toml
```

Both `wrangler.toml` and `worker/wrangler.toml` must reference the same D1
`database_id`.

## Secrets / environment

Set as Pages secrets (never commit them):

| Name | Purpose |
|------|---------|
| `SESSION_SECRET` | HMAC key that signs the session cookie and password-reset tokens |
| `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` | Mailjet transactional email credentials |
| `EMAIL_FROM` | Optional sender override; defaults to the address in `functions/_lib/email.ts` |

```bash
npx wrangler pages secret put SESSION_SECRET --project-name hollywood101tipovacka
```

## Auth & email

- Email/password accounts. Passwords hashed with PBKDF2-SHA256 (100k iterations) —
  see `functions/_lib/auth.ts`.
- Sign-up creates a `pending_activation` user; the user activates with a pre-generated
  **activation code** (admin-managed), then logs in.
- Sessions are a signed cookie (`tipovacka_session`), stateless HMAC over
  `{userId, exp}`.
- Password reset uses a **stateless** HMAC token over `userId.exp.passwordHash` (no DB
  table; self-invalidates when the password changes or after 1 hour).
- Transactional email goes through **Mailjet** (Send API v3.1, single verified sender —
  no domain required). `sendEmail()` no-ops when the Mailjet keys are absent (e.g. local
  dev). See `functions/_lib/email.ts`.

## API routes (overview)

- Auth: `POST /api/auth/{signup,activate,login,logout,forgot-password,reset-password,change-password,request-code}`
- Session: `GET /api/me`, `DELETE /api/account/delete`
- Contests: `GET /api/contests`, `POST /api/contests/guess`
- Results: `GET /api/results`, `GET /api/results/history`, `GET /api/results/:id`
- Coins: `GET /api/coins/history`, `POST /api/coins/request`
- Admin: `/api/admin/rounds`, `/api/admin/rounds/:id`, `/api/admin/movies/:id`,
  `/api/admin/activation-codes`, `/api/admin/activation-codes/:id`,
  `/api/admin/code-requests`, `/api/admin/code-requests/:id`
