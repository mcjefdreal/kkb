# AGENTS.md

SvelteKit minimal app (Svelte 5, TypeScript, Tailwind v4, Vite). Scaffolded
with `sv create`; no tests, no CI. Deployment target is Convex Cloud behind the
site owner's existing Caddy reverse proxy.

## Commands

- `pnpm dev` — Vite dev server.
- `pnpm build` — production build (uses `@sveltejs/adapter-node`).
- `pnpm start` — run the production Node server.
- `pnpm preview` — preview the build.
- `pnpm check` — runs `svelte-kit sync && svelte-check`. Sync must run first;
  it regenerates `.svelte-kit/` (gitignored) including the extended tsconfig.
- `pnpm check:watch` — same, in watch mode.
- `pnpm lint` — `prettier --check . && eslint .` (Prettier first, then ESLint;
  Prettier handles `.svelte` via `prettier-plugin-svelte`).
- `pnpm format` — `prettier --write .`.

`prepare` runs `svelte-kit sync` on `pnpm install`.

## Toolchain quirks

- **Svelte 5 with runes forced on.** `vite.config.ts` sets
  `compilerOptions.runes = true` for all non-`node_modules` files. Use runes
  (`$state`, `$derived`, `$props`, `$effect`) — do not write legacy reactive
  syntax. Can be removed once the project is on Svelte 6.
- **TypeScript 6 + `rewriteRelativeImportExtensions`.** Relative imports
  must include the `.ts` / `.js` extension.
- **Tailwind v4.** Imported via `@import 'tailwindcss';` in
  `src/routes/layout.css`; the `@tailwindcss/typography` plugin is registered
  there. `prettier-plugin-tailwindcss` is configured to read classes from
  `./src/routes/layout.css`.
- **pnpm `allowBuilds`.** `pnpm-workspace.yaml` whitelists native builds for
  `@tailwindcss/oxide` and `esbuild`. Keep this list in sync if a new native
  dep is added — pnpm will otherwise prompt or block the install.
- **`.npmrc` has `engine-strict=true`.** `package.json` already has an `engines`
  field (node>=20, pnpm>=9); keep it in sync.
- **Adapter is `@sveltejs/adapter-node`.** The build output is a standalone Node
  server. See `docker-compose.yml` for the app container setup and `Caddyfile`
  for the snippet to merge into your host Caddy.

## Deployment

- **Target: Convex Cloud + your existing host Caddy + Docker Compose (app
  container only).** The app is built with `@sveltejs/adapter-node` and served
  behind your existing Caddy on a single public domain. Caddy proxies
  `/api/auth/*` and `/api/bot/*` to the Convex site origin, `/api` and `/api/*`
  (including the WebSocket handshake) to the Convex cloud origin, and
  everything else to the SvelteKit Node app at `localhost:3000`. The
  `Caddyfile` in this repo is a snippet to merge into your existing Caddyfile.
- **`PUBLIC_CONVEX_URL` is build-time.** SvelteKit inlines `$env/static/public`
  during `vite build`. The Dockerfile accepts `PUBLIC_CONVEX_URL` as a build
  argument (derived from `DOMAIN` in `docker-compose.yml`) and writes it to
  `.env.production` before building. Changing domains requires a rebuild.
- **Three distinct env surfaces:**
  - Server `.env` (from `.env.production.example`): `DOMAIN`. The Convex Cloud
    URLs are pasted directly into the `Caddyfile` snippet.
  - Convex Cloud backend env (set via `npx convex env set` on the production
    deployment): `SITE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
    `GOOGLE_CLIENT_SECRET`, `BOT_API_KEY`.
  - CLI `.env.local` (deploy machine): `CONVEX_DEPLOYMENT=prod:<name>`.
- **Set `SITE_URL` before the first production deploy.** BetterAuth derives the
  session cookie domain from it. If the first deploy runs without it, cookies
  are issued for `.convex.site` and login on the public domain fails. Changing
  `SITE_URL` later requires `npx convex deploy` because it is read at module
  load time in `convex/betterAuth/auth.ts`.
- **Server-side Convex calls resolve locally.** `src/lib/loaders/roomGuard.ts`
  calls `https://<DOMAIN>/api/*` from inside the app container. The compose file
  adds `extra_hosts: ["${DOMAIN}:host-gateway"]` so the container resolves the
  domain to the Docker host and reaches Caddy locally, avoiding public-DNS
  hairpin issues. Ensure the host Caddy binds to `0.0.0.0:443` (or to an address
  reachable from the Docker bridge gateway, typically `172.17.0.1`). If Caddy
  itself runs in a Docker container, use a shared Docker network with
  `reverse_proxy app:3000`, or run the app with `network_mode: host`.
- **Google OAuth redirect URI:** must exactly match
  `https://<DOMAIN>/api/auth/callback/google` in the production Google OAuth
  client.
- **WebSocket origin:** Caddy forwards `Origin: https://<DOMAIN>` to Convex
  Cloud. If live queries fail with a 403 on the WebSocket handshake, add the
  domain to the allowed origins list in the Convex dashboard for the production
  deployment.

## Layout

- `src/routes/+layout.svelte` — root layout, imports `layout.css` and the
  favicon from `$lib/assets/`.
- `src/routes/+page.svelte` — single page (placeholder content).
- `src/lib/` — `$lib` alias root; holds `assets/`, shared helpers like
  `labels.ts`, and reusable components.
- `src/app.html`, `src/app.d.ts` — SvelteKit shell and ambient types.
- `static/` — served as-is (Prettier-ignored).
- `.svelte-kit/` — generated; do not edit, do not commit.

## Style

- Tabs, single quotes, no trailing commas, 100-col width (`.prettierrc`).
- ESLint uses `typescript-eslint` recommended + `svelte` recommended;
  `no-undef` is off (TS handles it). `eslint-config-prettier` last, so
  Prettier wins on formatting disputes.

## Settlement / rooms domain notes

- `rooms.status` is `collecting | settling | settled`. `settled` is displayed as
  "All payments settled".
- `settlementPayments.status` is `pending | pending_confirmation | paid`. Every
  payment method — cash, GCash, Maya — goes to `pending_confirmation` when the
  payer marks it sent, then to `paid` once the payee confirms receipt. The payer
  can undo a `pending_confirmation` payment back to `pending`; the UI label for
  this action is "Undo".
- `checkAndSettleRoom(ctx, roomId)` in `convex/rooms.ts` is the single place
  that flips a room to `settled` once every payment is `paid`. It is called only
  from `confirmPayment`.
- `reopenRoom` only succeeds while no payments are `paid` or
  `pending_confirmation`; any in-progress payment blocks reopening.
- Status and method labels live in `src/lib/labels.ts` (`roomStatusLabel`,
  `paymentStatusLabel`, `paymentMethodLabel`) so UI wording doesn't drift.
- Room deletion is creator-only (enforced server-side by `creatorMutation`):
  - dashboard room list: per-row Delete button for creators;
  - room page: Delete button appears when `status === 'settled'`;
  - settings page: existing Delete button remains available to creators at any
    status.
- **Contributions may exceed the bill total** (over-funding). The per-contributor
  ₱1,000,000 hard cap still applies. Over-funded rooms finalize without error.
  After settlement, `computeSettlement` returns a `change[]` list — each
  creditor's residual amount after internal debtor→creditor payments. This
  represents how much over-contributed cash should be returned from the pool
  (display-only; not a settlementPayment). `applyResidueToLargestCreditor` was
  removed; the over-funded residual is now surfaced per-creditor as `change`.
- **`finalizeSettlement`** accepts `totalContributed >= totalCost` (blocks
  under-funding only). If no debtor→creditor transactions are needed (e.g. all
  members contributed ≥ their owed share), the room is set directly to
  `'settled'` instead of `'settling'`, fixing a pre-existing stuck-room bug.

## Error handling

- `src/lib/errors.ts` exports `friendlyError(err, fallback)`, the single place
  that translates server-side and client-side error strings into user-facing
  toast messages.
- All mutation/action catch blocks that surface errors via `toasts.add` must use
  `friendlyError`. Add any new server error strings to the table in
  `src/lib/errors.ts`.
- Inline field-validation messages (e.g. in `ContributionInput.svelte` and
  `ItemEditor.svelte`) stay raw; they are already user-facing and contextual.

## Pre-PR checklist

1. `pnpm check`
2. `pnpm lint`
3. `pnpm build` (catches adapter / SSR issues that `dev` hides)

## Pre-deploy verification checklist

Before a production deploy is considered done:

1. DNS for `<DOMAIN>` resolves to the server public IP.
2. `pnpm check`, `pnpm lint`, and `pnpm build` pass locally.
3. `docker compose config` exits cleanly.
4. `npx convex env set SITE_URL https://<DOMAIN>` (and the other backend env vars)
   ran before the first `npx convex deploy`.
5. The Google OAuth redirect URI `https://<DOMAIN>/api/auth/callback/google` is
   configured.
6. After merging the `Caddyfile` snippet, running `caddy reload`, and starting the
   app with `docker compose up -d --build`:
   - `curl https://<DOMAIN>/api/bot/health` returns `{ ok: true }`.
   - Google login succeeds and the session cookie is `Secure` + `SameSite=Lax`.
   - Live queries (WebSocket) work without 403 errors.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
