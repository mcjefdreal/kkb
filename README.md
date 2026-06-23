# KKB

Bill-splitting web app built with SvelteKit, Convex Cloud, and BetterAuth.

## Stack

- Frontend: SvelteKit (Svelte 5 runes, TypeScript 6, Tailwind v4, Vite 8)
- Backend: Convex Cloud with BetterAuth on Convex
- Realtime: `convex-svelte` + `@convex-dev/better-auth`
- Deploy: `@sveltejs/adapter-node` app container behind your existing Caddy reverse proxy

## Local development

1. Install dependencies:

```sh
pnpm install
```

2. Copy `.env.example` to `.env.local` and fill in the dev URLs.

3. Authenticate with Convex and start a dev deployment:

```sh
npx convex dev
```

4. Set Convex environment variables for auth on the dev deployment:

```sh
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:5173
npx convex env set GOOGLE_CLIENT_ID "your-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-google-client-secret"
```

5. Run the SvelteKit dev server:

```sh
pnpm dev
```

## Google OAuth setup

1. Create a Web application OAuth client in Google Cloud Console.
2. Add authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback/google` for development
   - `https://<your-domain>/api/auth/callback/google` for production
3. Copy the Client ID and Secret into the Convex env vars for each deployment.

For production, create a separate Google OAuth client (or at least a separate set of
credentials) that is tied to your public domain. Do not reuse localhost credentials
for the deployed site.

## Environment variables

### Local development

Use `.env.example` as a template for `.env.local`:

```sh
PUBLIC_CONVEX_URL=http://localhost:5173
PUBLIC_CONVEX_SITE_URL=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173
```

The dev Vite proxy forwards `/api/auth` and `/api/bot` to the Convex site origin and
`/api` to the Convex cloud origin, so `localhost:5173` works for all three.

### Production (server `.env`)

Copy `.env.production.example` to `.env` on the server:

```sh
DOMAIN=kkb.example.com
```

`DOMAIN` must be bare host only: no `https://`, no trailing slash.

The Convex Cloud URLs go into the `Caddyfile` snippet (replace the placeholders
there). They are not read by the compose file.

### App container runtime env

`docker-compose.yml` sets these from `DOMAIN`:

```sh
ORIGIN=https://${DOMAIN}
PROTOCOL_HEADER=x-forwarded-proto
ADDRESS_HEADER=x-forwarded-for
XFF_DEPTH=1
HOST=0.0.0.0
PORT=3000
SHUTDOWN_TIMEOUT=30
```

`XFF_DEPTH=1` is correct when Caddy is the only proxy the app sees. If your Caddy
sits behind a CDN (Cloudflare, etc.), increase this to match the number of trusted
proxy hops.

### Convex env vars (set via `npx convex env set` on the production deployment)

- `BETTER_AUTH_SECRET` — random secret for auth tokens
- `SITE_URL` — public URL of the SvelteKit app (`https://<your-domain>`)
- `GOOGLE_CLIENT_ID` — production Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — production Google OAuth client secret
- `BOT_API_KEY` — random secret for the future Telegram bot HTTP API

## Production deployment

### 1. Create a production Convex deployment

On the machine that will push code (your workstation or CI):

```sh
npx convex login
npx convex dev
```

Then point the CLI at the production deployment by setting `CONVEX_DEPLOYMENT` in
`.env.local`:

```sh
CONVEX_DEPLOYMENT=prod:<deployment-name>
```

### 2. Set backend environment variables before the first deploy

BetterAuth derives the session cookie domain from `SITE_URL`. Set these **before**
`npx convex deploy` so the first deployment bakes the correct domain:

```sh
npx convex env set SITE_URL "https://<your-domain>"
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set GOOGLE_CLIENT_ID "your-prod-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-prod-google-client-secret"
npx convex env set BOT_API_KEY "$(openssl rand -base64 32)"
```

Changing `SITE_URL` later requires running `npx convex deploy` again because it is read
at module load time in `convex/betterAuth/auth.ts`.

### 3. Deploy the Convex code

```sh
npx convex deploy
```

### 4. Configure Google OAuth

Add the production redirect URI exactly:

```
https://<your-domain>/api/auth/callback/google
```

### 5. Configure DNS

Point `<your-domain>` to your server's public IP. Verify it resolves before reloading
Caddy so the ACME HTTP-01 challenge can succeed.

### 6. Add the Caddy site block

Merge the site block from `Caddyfile` into your existing Caddyfile, replace the three
placeholders with your real domain and Convex Cloud URLs, and reload Caddy:

```sh
caddy reload
```

Make sure your host Caddy binds to `0.0.0.0:443` (or at least to an address reachable
from the Docker bridge gateway, typically `172.17.0.1`). The app container resolves its
own domain to `host-gateway` for server-side Convex calls.

### 7. Start the app on the server

Copy the repository to the server, fill `.env` from `.env.production.example`, then:

```sh
docker compose up -d --build
```

This starts the SvelteKit Node app container listening on `127.0.0.1:3000`. Only your
host Caddy can reach it.

### Reverse proxy path precedence

Caddy routes by path in this exact order:

| Path | Upstream | Purpose |
|---|---|---|
| `/api/auth/*` | `https://<deployment>.convex.site` | BetterAuth routes + token endpoint + Google callback |
| `/api/bot/*` | `https://<deployment>.convex.site` | Bot HTTP actions |
| `/api`, `/api/*` (WS) | `https://<deployment>.convex.cloud` | Convex queries/mutations + live-query WebSocket |
| `*` | `localhost:3000` | SvelteKit SSR + assets |

The bare `/api` path is the WebSocket handshake for Convex live queries; it must be
matched alongside `/api/*`.

### Server-side Convex calls

`src/lib/loaders/roomGuard.ts` calls Convex from the SvelteKit server using
`PUBLIC_CONVEX_URL` (which is baked to `https://<your-domain>`). The app container uses
`extra_hosts: ["${DOMAIN}:host-gateway"]` so these calls resolve to the Docker host and
reach your host Caddy locally, avoiding public-DNS hairpin issues.

### If your Caddy also runs in a Docker container

`reverse_proxy localhost:3000` in the snippet will not work because `localhost` is the
Caddy container's loopback, not the host. Either:

1. Put the app container and Caddy container on the same Docker network and change the
   snippet to `reverse_proxy app:3000`.
2. Or run the app container with `network_mode: host` and keep `localhost:3000`.

### WebSocket origin check

Caddy forwards the browser's `Origin: https://<your-domain>` header to Convex Cloud. If
live queries fail with a 403 on the WebSocket handshake, add your domain to the allowed
origins list in the Convex dashboard for the production deployment.

### Bot API

Convex HTTP actions expose `/api/bot/*` endpoints protected by the `BOT_API_KEY` header
(`Authorization: Bearer <BOT_API_KEY>`). Rotate this key before enabling any external
bot.

## Pre-deploy verification checklist

Before calling the deploy done:

1. `pnpm check` passes.
2. `pnpm lint` passes.
3. `pnpm build` produces `build/`.
4. `NODE_ENV=production node build` starts locally without errors.
5. `docker compose config` exits cleanly.
6. DNS for `<your-domain>` resolves to the server's public IP.
7. After `docker compose up -d --build` and `caddy reload`:
   - `curl https://<your-domain>/api/bot/health` returns `{ ok: true }`.
   - Login with Google works and the session cookie has `Secure` and `SameSite=Lax`.
   - Opening a room shows live updates (WebSocket) without 403 errors.

## Pre-PR checklist

```sh
pnpm check
pnpm lint
pnpm build
npx convex dev
```

The `convex/` directory is excluded from Prettier and ESLint because it runs on
a different runtime. Convex functions are typechecked by `npx convex dev`.
