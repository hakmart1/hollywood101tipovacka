# CLAUDE.md — operational notes for AI assistants / maintainers

Handoff notes for working on this repo (e.g. from a different machine). Read the
[README](README.md) first for architecture. This file captures the non-obvious
operational knowledge. **This repo is public — never commit secrets, API tokens, or
credentials here.**

## Deploy topology

- **Web app (Pages + Functions):** git-connected. Pushing to `main` auto-builds and
  deploys (`yarn build` → `dist`). There is no manual deploy for the web app.
- **Cron worker (`worker/`):** deployed separately and manually:
  `npx wrangler deploy --config worker/wrangler.toml`. Do this whenever `worker/` or the
  shared code it imports (`functions/_lib/evaluate.ts`, `scoring.ts`) changes.
- Both `wrangler.toml` and `worker/wrangler.toml` must point at the **same** D1
  `database_id`.

## Cloudflare account

The whole stack runs on the Cloudflare account for **hollywood101tipovacka@gmail.com**
(migrated here on 2026-07-10 from a personal account). Get IDs at runtime rather than
hardcoding: `npx wrangler whoami`, the dashboard, or `database_id` in `wrangler.toml`.

Local `wrangler` auth: log in with an account that has access, or use a scoped API
token with **Workers Scripts: Edit, Cloudflare Pages: Edit, D1: Edit, Account Settings:
Read**. Note: with a token lacking *User Details: Read*, some `wrangler` commands print a
warning and a few (e.g. `pages project list`) can fail — when that happens, hit the
Cloudflare REST API directly (`/accounts/:id/pages/projects...`) with the token.

## Gotchas (learned the hard way)

- **Secrets apply to the next deployment only.** After
  `wrangler pages secret put ...`, trigger a redeploy or the running deployment won't
  see the new value.
- **First request after a fresh deploy can return HTTP 500 (Error 1101)** for a few
  seconds while the edge picks up bindings/secrets. It self-heals — retry before
  concluding something is broken. Not a data bug.
- **D1 migrations:** forward-only. Never edit an applied migration (add `000N_*.sql`).
  Never put `DROP TABLE` at the top of one — D1 ignores `PRAGMA foreign_keys=OFF` inside
  the migration transaction, so drops can cascade and wipe data.
- **D1 export/import between accounts:** `wrangler d1 export <name>` resolves the DB by
  the `database_id` in the active config, not by account. To export from a different
  account, pass a `--config` file with that account's `database_id` and use that
  account's credentials.

## Verifying a deploy (no local run needed)

Against the live URL (`https://hollywood101tipovacka.pages.dev`):

- `GET /api/me` with no cookie → `{"user":null,"error":null}` (Functions alive).
- `GET /api/results/history?page=0` → real JSON rows (D1 binding works).
- `POST /api/auth/login` with a known account → 200 + `Set-Cookie` (auth + SESSION_SECRET
  + DB write all work). There are test player accounts `test1..7@test.cz` (password known
  to the maintainer — not stored here).

## Email

Transactional email via **Mailjet**. Sender is `DEFAULT_SENDER` in
`functions/_lib/email.ts` — `tipovacka@hollywood101.cz`, domain-authenticated via SPF +
DKIM (TXT records at Forpsi), with `Reply-To: hollywood101tipovacka@gmail.com` because
the domain has no mailbox/MX. `sendEmail()` no-ops if the Mailjet keys are unset (local
dev). Secrets: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`.

Notes: domain sending works off SPF+DKIM even though the individual Mailjet "sender"
entry shows *Inactive* (its activation email can't be received — no mailbox); that's
fine. Never send From a `@gmail.com` address via Mailjet — it fails DMARC alignment and
lands in spam.

## DNS

The domain `hollywood101.cz` is hosted at **Forpsi** (external — *not* on Cloudflare),
so all DNS records are added manually in Forpsi's panel; Cloudflare/Wrangler cannot
manage them.

## Current in-progress work (as of 2026-07-10)

- **Custom domain `tipovacka.hollywood101.cz`** — **live.** CNAME
  `tipovacka → hollywood101tipovacka.pages.dev` is set at Forpsi, Cloudflare validated it
  and issued SSL. Both this and `hollywood101tipovacka.pages.dev` serve the app (no
  redirect between them). Note: Forpsi has a wildcard `*.hollywood101.cz` → apex, so any
  new subdomain needs an explicit record to override it.
- **Domain email sender `tipovacka@hollywood101.cz`** — **live.** SPF + DKIM +
  ownership TXT records are at Forpsi (Mailjet DNS check = OK), `DEFAULT_SENDER` is the
  domain address with `Reply-To` to gmail. See the Email section above.
