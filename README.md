# Hollywood 101 Tipovacka

Small Cloudflare app for a movie box office guessing game.

## Phase 1: D1 database

This repository currently contains the D1 migration only.

- `users`: players and admins, including activation state and current `ImfCoins` balance
- `activation_codes`: pre-generated activation codes that are assigned to users when consumed
- `user_auth_identities`: auth providers per user so local login can later grow into Google or Facebook
- `imf_coin_history`: full history of every `ImfCoins` change
- `rounds`: admin-controlled round windows, each linked to a season key
- `round_movies`: the movies configured for each round, typically five rows per round
- `faq_entries`: static FAQ content editable by admin users
- `settings`: global app settings managed from admin, starting with the current season name

## Cloudflare D1 setup

1. Install Wrangler if needed:

```bash
npm install -D wrangler
```

2. Log in to Cloudflare:

```bash
npx wrangler login
```

3. Create the D1 database:

```bash
npx wrangler d1 create hollywood101-tipovacka-db
```

4. Copy the returned `database_id` into `wrangler.toml`.

5. Apply the initial migration to your remote Cloudflare database:

```bash
npx wrangler d1 migrations apply hollywood101-tipovacka-db --remote
```

6. Optional: inspect the remote database:

```bash
npx wrangler d1 execute hollywood101-tipovacka-db --remote --command "SELECT name FROM sqlite_master WHERE type = 'table';"
```

## Local development DB

If you want a local D1 copy for testing:

```bash
npx wrangler d1 migrations apply hollywood101-tipovacka-db --local
```

## Current structure

- `wrangler.toml`: Cloudflare D1 binding config
- `db/migrations/0001_initial.sql`: first D1 schema migration

## Updating tables later

Do not put `DROP TABLE` statements at the top of the initial migration.

Use a new migration file every time the schema changes, for example:

```bash
npx wrangler d1 migrations create hollywood101-tipovacka-db add-guesses-table
```

Then edit the new SQL file and apply it:

```bash
npx wrangler d1 migrations apply hollywood101-tipovacka-db --remote
```

Recommended rule:

- keep `0001_initial.sql` as the original starting point
- create `0002_*`, `0003_*`, and so on for later changes
- use `ALTER TABLE` or copy-data migrations instead of dropping everything

For local-only resets, it is fine to recreate the local database from scratch. For the remote Cloudflare database, prefer forward-only migrations.

## Email activation auth

This repo now includes:

- `src/App.tsx`: a basic React landing page with sign-up and login forms
- `functions/api/auth/signup.ts`: creates a pending account with local email/password auth
- `functions/api/auth/activate.ts`: consumes a stored activation code and unlocks the account
- `functions/api/auth/login.ts`: verifies email/password and sets a signed session cookie
- `functions/api/me.ts`: returns the signed-in user from the session cookie
- `functions/api/logout.ts`: clears the session cookie

### Current routes

- `POST /api/auth/signup`
- `POST /api/auth/activate`
- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/logout`

### Required Pages secret

The email-first flow currently needs only one secret:

```bash
yarn wrangler pages secret put SESSION_SECRET --project-name hollywood101tipovacka
```

`SESSION_SECRET` signs the login cookie after a successful login.

### Current activation flow

1. User signs up with nickname, email, and password.
2. Backend creates a `pending_activation` user only.
3. User enters the activation code.
4. Backend finds a pre-generated activation code stored in D1, assigns it to that user, and marks the user as `active`.
5. User logs in with email and password.
6. Backend sets a signed session cookie.

### Real email delivery later

The activation flow is ready for a real email sender, but this repo does not yet send emails through a provider. The next step can be wiring `signup` to Resend, MailChannels, or another email service.
