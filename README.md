# KKB

Bill-splitting web app built with SvelteKit, Convex, and BetterAuth.

## Stack

- Frontend: SvelteKit (Svelte 5 runes, TypeScript 6, Tailwind v4, Vite 8)
- Backend: Self-hosted Convex with BetterAuth on Convex
- Realtime: `@mmailaender/convex-svelte` + `@mmailaender/convex-better-auth-svelte`
- Deploy: `@sveltejs/adapter-node` for the frontend; Convex backend in Docker

## Local development

1. Install dependencies:

```sh
pnpm install
```

2. Copy `.env.example` to `.env` and fill in your Convex URLs.

3. Start the local Convex backend:

```sh
npx convex dev
```

4. Set Convex environment variables for auth:

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
   - `http://localhost:5173/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google` for production
3. Copy the Client ID and Secret into the Convex env vars above.

## Environment variables

### SvelteKit `.env`

```sh
PUBLIC_CONVEX_URL=http://127.0.0.1:3210
PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
PUBLIC_SITE_URL=http://localhost:5173
```

### Convex env vars (set via `npx convex env set`)

- `BETTER_AUTH_SECRET` — random secret for auth tokens
- `SITE_URL` — public URL of the SvelteKit app
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BOT_API_KEY` — random secret for the future Telegram bot HTTP API

## Production deployment

### SvelteKit (Node adapter)

```sh
pnpm build
node build
```

### Self-hosted Convex

Run Convex in Docker and point `PUBLIC_CONVEX_URL` / `PUBLIC_CONVEX_SITE_URL` at it.

Make sure your reverse proxy:

- Sets `Access-Control-Allow-Origin` for your SvelteKit domain
- Forwards WebSocket upgrade headers for live queries

### Bot API

Convex HTTP actions expose `/api/bot/*` endpoints protected by the `BOT_API_KEY`
header (`Authorization: Bearer <BOT_API_KEY>`). Rotate this key before enabling
any external bot.

## Auth fallback (Plan B)

If the Convex-hosted BetterAuth token bridge cannot be made to work, the project
would need a full backend rewrite to Postgres + Drizzle + BetterAuth with SSE or
`pg-listen` realtime. This is only a last resort after exhausting the official
Convex + BetterAuth integration.

## Pre-PR checklist

```sh
pnpm check
pnpm lint
pnpm build
npx convex dev
```

The `convex/` directory is excluded from Prettier and ESLint because it runs on
a different runtime. Convex functions are typechecked by `npx convex dev`.
