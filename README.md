# Hollywood 101 Tipovacka

Small Cloudflare app for a movie box office guessing game.

## Phase 1: D1 database

This repository currently contains the D1 migration only.

- `users`: players and admins, including activation state and current `ImfCoins` balance
- `activation_codes`: activation codes verified during user unlock flow
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

## Google sign-in setup

This repo now includes:

- `public/index.html`: a basic landing page with a Google sign-in button
- `functions/api/*`: Cloudflare Pages Functions for Google auth and session handling

### Worker routes

- `GET /api/auth/google/start`: redirects the browser to Google OAuth
- `GET /api/auth/google/callback`: exchanges the code, creates or links the account, and sets a session cookie
- `GET /api/me`: returns the signed-in user from the session cookie
- `POST /api/logout`: clears the session cookie

### Google Cloud setup

1. Open Google Cloud Console.
2. Create or pick a project.
3. Configure the OAuth consent screen.
4. Create an OAuth client of type `Web application`.
5. Add this redirect URI:

```text
https://YOUR_WORKER_DOMAIN/api/auth/google/callback
```

If you test on the default Workers domain, it will look like:

```text
https://hollywood101tipovacka.pages.dev/api/auth/google/callback
```

### Cloudflare Pages secrets

Add the required Worker secrets:

```bash
yarn wrangler pages secret put GOOGLE_CLIENT_ID --project-name hollywood101tipovacka
yarn wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name hollywood101tipovacka
yarn wrangler pages secret put GOOGLE_REDIRECT_URI --project-name hollywood101tipovacka
yarn wrangler pages secret put SESSION_SECRET --project-name hollywood101tipovacka
```

Recommended values:

- `GOOGLE_CLIENT_ID`: from Google Cloud OAuth client
- `GOOGLE_CLIENT_SECRET`: from Google Cloud OAuth client
- `GOOGLE_REDIRECT_URI`: the exact callback URL you registered in Google Cloud
- `SESSION_SECRET`: a long random string used to sign login cookies

### Deploy the Pages project

After secrets are set:

```bash
yarn wrangler pages deploy public --project-name hollywood101tipovacka
```

### Account creation and login flow

1. User clicks `Continue with Google` on the frontend.
2. Worker redirects to Google.
3. Google returns to `/api/auth/google/callback`.
4. Worker exchanges the authorization code for tokens.
5. Worker fetches the Google user profile.
6. Worker checks `user_auth_identities` for `provider = 'google'`.
7. If the identity exists, the existing account is used.
8. If not, the Worker links by email when possible or creates a new `users` row and a new `user_auth_identities` row.
9. Worker sets a signed session cookie.
10. Frontend calls `/api/me` to detect the signed-in user.
