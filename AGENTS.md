# AGENTS.md

SvelteKit minimal app (Svelte 5, TypeScript, Tailwind v4, Vite). Scaffolded
with `sv create`; no tests, no CI, no deploy target configured yet.

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
  server. See `docker-compose.yml` for the Caddy + Docker Compose production
  setup.

## Deployment

- **Target: Convex Cloud + Caddy + Docker Compose.** The app is built with
  `@sveltejs/adapter-node` and served behind Caddy on a single public domain.
  Caddy proxies `/api/auth/*` and `/api/bot/*` to the Convex site origin,
  `/api` and `/api/*` (including the WebSocket handshake) to the Convex cloud
  origin, and everything else to the SvelteKit Node app.
- **`PUBLIC_CONVEX_URL` is build-time.** SvelteKit inlines `$env/static/public`
  during `vite build`. The Dockerfile accepts `PUBLIC_CONVEX_URL` as a build
  argument (derived from `DOMAIN` in `docker-compose.yml`) and writes it to
  `.env.production` before building. Changing domains requires a rebuild.
- **Three distinct env surfaces:**
  - Server `.env` (from `.env.production.example`): `DOMAIN`,
    `CONVEX_CLOUD_URL`, `CONVEX_SITE_URL`.
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
  hairpin issues.
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
- `settlementPayments.status` is `pending | pending_confirmation | paid`. Cash
  goes straight to `paid`; e-wallets go `pending_confirmation` until the payee
  confirms, then `paid`.
- `checkAndSettleRoom(ctx, roomId)` in `convex/rooms.ts` is the single place
  that flips a room to `settled` once every payment is `paid`. It is called from
  both `markPaid` (cash path) and `confirmPayment`, which fixes the previous bug
  where a cash-as-last-payment left the room stuck on `settling`.
- Status and method labels live in `src/lib/labels.ts` (`roomStatusLabel`,
  `paymentStatusLabel`, `paymentMethodLabel`) so UI wording doesn't drift.
- Room deletion is creator-only (enforced server-side by `creatorMutation`):
  - dashboard room list: per-row Delete button for creators;
  - room page: Delete button appears when `status === 'settled'`;
  - settings page: existing Delete button remains available to creators at any
    status.

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
6. After `docker compose up -d --build`:
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
