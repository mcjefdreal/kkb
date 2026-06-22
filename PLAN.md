# KKB — Bill-Splitting Web App: Implementation Plan

## Overview

Build "KKB", a bill-splitting web app. A payer creates a "room" for a bill, lists items, and is the initial contributor. The creator can promote joined members to "contributor"; each contributor enters only their own contribution amount (creator cannot edit others' amounts); all contributions are visible to the group. Friends join via a short code and claim items (every item must be fully claimed to settle). The app computes who-owes-whom (contributors who also consumed are netted). A real-time dashboard tracks payments via GCash, Maya, or cash — cash is trust-based (payer marks paid → confirmed immediately); e-wallets are payer-marks-paid → payee-confirms. Google OAuth via BetterAuth. A shared backend (Convex HTTP actions) that a future Telegram bot can reuse. Self-hostable. Realtime is important → Convex.

**In scope:** web app + backend + auth + realtime + settlement + payments.
**Out of scope (later):** the Telegram bot itself, automated payment verification (merchant APIs), receipt OCR, multi-currency. Architecture supports the bot dropping in later.

---

## Stack

- **Frontend:** SvelteKit (Svelte 5 runes forced on, TypeScript 6, Tailwind v4, Vite 8, pnpm).
- **Backend:** Self-hosted Convex (Docker for prod, local dev backend via `npx convex dev`).
- **Auth:** BetterAuth running **on Convex** via `@convex-dev/better-auth` (first-party, Convex-maintained). Google OAuth. SvelteKit proxies `/api/auth/*` to Convex.
- **Realtime data:** `convex-svelte` (official, Svelte 5 runes) — `useQuery`/`useMutation` live subscriptions.
- **Deploy:** `adapter-node` for SvelteKit; Convex backend in Docker.

### Plan B (full backend rewrite, NOT a soft fallback)

If the auth token-bridge spike (step 6) fails AND manual rewiring from official primitives also fails, pivot to: Postgres + Drizzle + BetterAuth (most mature auth path) + `pg-listen`/SSE realtime. This is a **full backend rewrite** — all Convex functions, realtime, authz would be rehomed. Decide this at step 6 before investing in business logic.

---

## Project Context & Conventions

- SvelteKit scaffold at `\\wsl.localhost\Ubuntu\home\mcjefd\kkb` (WSL).
- **Svelte 5 runes forced on** (`vite.config.ts` `compilerOptions.runes = true`). Use `$state`, `$derived`, `$props`, `$effect`. No legacy reactive syntax.
- **TypeScript 6 + `rewriteRelativeImportExtensions`.** Relative imports MUST include `.ts`/`.js` extension.
- **Tailwind v4** via `@import 'tailwindcss';` in `src/routes/layout.css`; `@tailwindcss/typography` plugin registered there.
- **Style:** Tabs, single quotes, no trailing commas, 100-col width (`.prettierrc`).
- **pnpm** via `corepack pnpm` (global `corepack enable pnpm` fails with EPERM on Windows Node path). `packageManager: "pnpm@10.8.0"`.
- `pnpm-workspace.yaml` uses `allowBuilds` (pnpm v10 feature) and requires `packages: ['.']`.
- `engine-strict=true` in `.npmrc`.
- **Pre-PR checklist:** `pnpm check`, `pnpm lint`, `pnpm build`, `npx convex dev` (typechecks Convex functions).
- `convex/` directory is **excluded from Prettier and ESLint** (different runtime; would break `pnpm lint`).
- **Do NOT run prettier/lint/build mid-implementation.** User will manually format/lint/check after all files are finished.

### Already done (step 1)
- `package.json`: added `"packageManager": "pnpm@10.8.0"` and `"engines": {"node": ">=20.0.0", "pnpm": ">=9.0.0"}`.
- `pnpm-workspace.yaml`: added `packages: ['.']`.
- WSL git: `git config --global --add safe.directory '%(prefix)///wsl.localhost/Ubuntu/home/mcjefd/kkb'`.

---

## Design Decisions

| Decision | Chosen approach | Why |
|---|---|---|
| Backend | Self-hosted Convex (Docker) + BetterAuth | Realtime-first; first-party auth adapter. |
| Auth runs on Convex | BetterAuth instance in `convex/betterAuth/auth.ts`; SvelteKit proxies | Official pattern; env vars via `npx convex env set`. |
| Money | Integer centavos as `v.number()` with mutation validation `0 ≤ x ≤ 100_000_000` (₱1M ceiling) | Avoids bigint serialization risk; exact integer math ≪ 2^53. |
| Authz | **No RLS** — `roomQuery`/`roomMutation` wrapper HOF calls `requireMember`/`requireCreator`/`requireContributor` before delegating | Convex has no declarative RLS; wrapper is structural guardrail against silent leaks. |
| Contributor model | Roles `member`/`contributor` on `roomMembers`; creator always a contributor. Creator grants role (`setMemberRole`, creator-only). Each contributor sets **own** amount (`setContribution`, self-only). **Demotion/leave zeroes the contribution.** All visible. | User spec. |
| Contribution cap | `setContribution` rejects `amount > total − ΣotherContributions` | Prevents overshoot/bricked rooms. |
| Full-claim requirement | Finalize requires **every item fully claimed (`Σshares = qty`)** + `Σcontributions = total` | No div-by-zero; clean pro-rata split. |
| Settlement preview | Convex reactive **query** `previewSettlement` (`computeSettlement` lenient mode → amounts + flags) | Single source of truth, live, deduped. |
| Settlement finalize | **Single atomic mutation** `finalizeSettlement` (creator + `status='collecting'` → read → validate → compute → insert pending payments → flip to `settling`) | Eliminates action↔mutation race; no stale data, no double-finalize. |
| Payments | `cash`/`gcash`/`maya`. Available = `['cash']` + payee's configured e-wallets. `markPaid` **one-shot from `pending`**, method immutable; cash→`confirmed`, else→`pending_confirmation`; `unmarkPaid` for correction; `confirmPayment` payee-only. E-wallet re-checked at mark time. | Cash trust spec + bypass prevention. |
| Room lifecycle | `collecting → settling → settled`; lock freezes claims/contributions; reopen only if zero confirmed. | Protects paid state. |
| `createRoom` | **Action** (random 8-char code, ≤5 retries on conflict) → `insertRoom` mutation (atomic) | Randomness needs an action; unique-index + retry. |
| Bot API | Convex HTTP actions (`convex/http.ts`) + **env var `BOT_API_KEY`** | Correct mechanism for Convex HTTP. |
| Deploy | `adapter-node` + Convex Docker; `PUBLIC_CONVEX_URL`; CORS origin + WS upgrade headers configured. | Self-host. |

---

## Architecture

### Topology

```
Browser ──(BetterAuth session)──▶ SvelteKit (Node, adapter-node) ──proxy──▶ Convex auth routes (http.ts)
Browser ──(convex-svelte: live queries+mutations, Convex auth token via ConvexBetterAuthProvider)──▶ Convex backend (Docker)
              ├ Convex functions (authz via wrappers; ctx.auth.getUserIdentity() works via auth.config.ts provider)
              ├ @convex-dev/better-auth component (user/session/account storage + auth handlers)
              └ Convex HTTP actions (http.ts) ◀── future Telegram bot (BOT_API_KEY)
BetterAuth runs ON Convex; SvelteKit is a thin proxy + SSR (getToken → initialToken).
```

### Repo layout (new/changed)

```
convex/
  convex.config.ts            # registers betterAuth component
  auth.config.ts              # getAuthConfigProvider() — registers BetterAuth as Convex auth provider
  betterAuth/
    convex.config.ts          # defineComponent("betterAuth")
    auth.ts                   # createAuth(ctx), createAuthOptions, options (Google + convex plugin)
    schema.ts                 # generated by `npx auth generate`
    adapter.ts                # createApi adapter functions
  schema.ts                   # app tables
  authz.ts                    # requireMember/Creator/Contributor + roomQuery/roomMutation wrappers
  settlement.ts               # computeSettlement(state, {strict|lenient})
  rooms.ts                    # createRoom(action), insertRoom, joinRoom, leaveRoom, setMemberRole, setContribution, finalizeSettlement(mutation), markPaid, unmarkPaid, confirmPayment, reopenRoom, deleteRoom
  claims.ts                   # setClaim, deleteClaim
  queries.ts                  # getRoomState, getRoomByCode, listMyRooms, getMyProfile, previewSettlement, whoami
  http.ts                     # authComponent.registerRoutes(http, createAuth) + bot HTTP actions (BOT_API_KEY)
src/
  app.d.ts                    # App.Locals { user, session }
  hooks.server.ts             # session resolution (via server getToken) + auth guard
  lib/auth-client.ts          # createAuthClient({ plugins: [convexClient()] })
  lib/convex.ts               # ConvexProvider (Svelte) with initialToken from server getToken
  lib/money.ts                # toCentavos, formatPHP
  lib/types.ts                # DB row types
  lib/components/
    ItemEditor.svelte
    ItemClaimGrid.svelte
    MemberList.svelte
    ContributionInput.svelte
    SettlementPreview.svelte
    SettlementList.svelte
    PaymentCard.svelte
  routes/
    +layout.svelte            # ConvexProvider + auth-aware nav
    +page.svelte              # landing
    api/auth/[...all]/+server.ts  # thin proxy to Convex auth routes
    login/+page.svelte
    logout/+server.ts
    profile/+page.svelte
    dashboard/+page.svelte
    join/+page.svelte
    rooms/new/+page.svelte
    rooms/[code]/
      +page.server.ts         # loader + member guard
      +page.svelte
      settings/+page.svelte
```

`convex/` excluded from SvelteKit prettier/eslint. Auth env vars via `npx convex env set`; SvelteKit `.env` only holds `PUBLIC_CONVEX_URL`/`PUBLIC_CONVEX_SITE_URL`/`PUBLIC_SITE_URL`.

### Data flow

1. **Auth:** Google → BetterAuth (on Convex) → session cookie → `hooks.server.ts` loads `locals.user` via server `getToken`; Convex client receives auth token via `ConvexBetterAuthProvider` so functions see `ctx.auth.getUserIdentity()`.
2. **Create room:** `/rooms/new` → `createRoom` action (identity; generates unique 8-char code via ≤5 retries; calls `insertRoom` mutation which atomically inserts room + creator membership `contributor` + items + creator contribution; returns code) → redirect to `/rooms/[code]`.
3. **Join:** `/join` → `getRoomByCode` (public, returns id+flag only, NO contents) → `joinRoom` mutation (insert membership `member`) → redirect.
4. **Promote contributor:** creator calls `setMemberRole(roomId, targetUserId, 'contributor')` (creator-only).
5. **Set contribution:** a contributor calls `setContribution(roomId, amount)` (**self-only**; rejects `amount > total − Σothers`); visible to all.
6. **Claim items:** `ItemClaimGrid` → `setClaim(itemId, shares)` (self; mutation validates `Σshares ≤ qty` atomically — Convex mutations are serializable).
7. **Preview:** room page `useQuery(getRoomState)` + `useQuery(previewSettlement)` — both reactive; preview recomputes live as claims/contributions change.
8. **Lock:** creator → `finalizeSettlement` mutation (verifies creator + `status='collecting'`; validates full-claims + `Σcontributions=total`; reads state; computes greedy; inserts `pending` payments; flips to `settling`); warns creator of creditors missing e-wallet.
9. **Pay:** `PaymentCard` shows payee's available methods (cash always) → payer `markPaid(id, method, ref)` → cash=`confirmed`; gcash/maya=`pending_confirmation`. Payee `confirmPayment(id)` → `confirmed`. All-confirmed → room `settled`. All live via `useQuery`.
10. **Bot (future):** Convex HTTP actions with `BOT_API_KEY` → calls the same mutations.

### Key interfaces

- `createRoom(name, items:[{name, priceCentavos, qty}], ownContributionCentavos) → string(code)` — **action**, identity, retries on code conflict → `insertRoom` mutation (atomic).
- `getRoomByCode(code) → {roomId, alreadyMember}` — public, **no contents**.
- `joinRoom(code) → roomId` — identity.
- `leaveRoom(roomId)` — zeroes own contribution.
- `setMemberRole(roomId, targetUserId, role:'member'|'contributor')` — **creator-only**; **demotion zeroes target's contribution**.
- `setContribution(roomId, amountCentavos)` — **self-only**, contributor-or-creator; **rejects `amount > total − Σothers`**.
- `setClaim(itemId, shares)` — self (claimer = identity); atomic `Σshares ≤ qty`.
- `deleteClaim(itemId)` — self.
- `finalizeSettlement(roomId)` — **mutation**, creator-only, `status='collecting'`; validates full-claims + `Σcontributions=total`; computes; inserts pending payments; flips to `settling`. Returns `{transactions, residueCentavos}`.
- `markPaid(settlementId, method:'cash'|'gcash'|'maya', reference?)` — payer-only, **only from `pending`**; method immutable; cash→`confirmed`, gcash/maya→`pending_confirmation` (re-checks payee e-wallet non-null).
- `unmarkPaid(settlementId)` — payer-only, `pending_confirmation→pending`.
- `confirmPayment(settlementId)` — payee-only → `confirmed`; all-confirmed → room `settled`.
- `reopenRoom(roomId)` — creator-only, zero confirmed → `collecting`.
- `deleteRoom(roomId)` — creator-only.
- `getRoomState(roomId)` — query, `requireMember` → `{room, members, items, claims, contributions, settlements}`.
- `previewSettlement(roomId)` — query, `requireMember` → `{transactions:[{payerUserId, payeeUserId, amountCentavos}], residueCentavos, unclaimedItems, fundingGap}`.
- `listMyRooms()` — query, identity → rooms where member (created + joined).
- `getMyProfile()` — query, identity → profile.
- `whoami()` — query → `ctx.auth.getUserIdentity()` (spike + debug).
- Auth client: `authClient.signIn.social({ provider: 'google', callbackURL })` via `convexClient()` plugin.

### Convex schema (`convex/schema.ts`)

Tables:
- `profiles`: `userId` (string, indexed), `displayName`, `gcashNumber` (optional string), `mayaNumber` (optional string), `createdAt`
- `rooms`: `code` (string, unique, indexed, 8-char), `name`, `createdBy` (string = userId), `status` (string enum: 'collecting'|'settling'|'settled'), `lastActivity` (number), `createdAt`
- `roomMembers`: `roomId` (Id<'rooms'>), `userId` (string), `role` (string enum: 'member'|'contributor'), `joinedAt`. Index on `[roomId, userId]` unique.
- `items`: `roomId`, `name`, `priceCentavos` (number, ≥0), `qty` (number, >0), `createdAt`
- `itemClaims`: `itemId` (Id<'items'>), `userId` (string), `shares` (number, >0). Index on `[itemId, userId]` unique.
- `contributions`: `roomId`, `userId` (string), `amountCentavos` (number, ≥0). Index on `[roomId, userId]` unique.
- `settlementPayments`: `roomId`, `payerUserId` (string), `payeeUserId` (string), `amountCentavos` (number, >0), `method` (string enum: 'cash'|'gcash'|'maya'|'pending'), `status` (string enum: 'pending'|'pending_confirmation'|'confirmed'), `reference` (optional string), `createdAt`

### Settlement algorithm (`convex/settlement.ts`)

Shared by `previewSettlement` (lenient) and `finalizeSettlement` (strict).

```
owed_u = Σ over items: (u_shares / total_shares) * (priceCentavos * qty)
       (per item; total_shares > 0 guaranteed by full-claim check at finalize)
net_u = contribution_centavos_u − owed_u
creditors: net > 0 (owed money)
debtors: net < 0 (owe money)
greedy: sort debtors ascending, creditors descending
  pair largest debtor ↔ largest creditor
  transfer = min(|debtor|, creditor)
  reduce both, repeat
  1¢ residue → largest creditor
  skip payer === payee
```

- **Strict mode** (finalize): throws on any unclaimed item (`total_shares = 0`) or `Σcontributions ≠ total`.
- **Lenient mode** (preview): returns `{transactions, residueCentavos, unclaimedItems, fundingGap}`.

### Authz model (no-RLS contract)

Convex has no declarative RLS. Security enforced in code:

- `requireMember(ctx, roomId)`: checks `ctx.auth.getUserIdentity()` non-null AND a `roomMembers` row exists for `(roomId, userId)`. Throws otherwise.
- `requireCreator(ctx, roomId)`: `requireMember` + `room.createdBy === userId`.
- `requireContributor(ctx, roomId)`: `requireMember` + member role is 'contributor' OR creator.
- **`roomQuery`/`roomMutation` wrapper HOF** in `authz.ts`: wraps every room-data function, calls the appropriate `require*` before delegating to the handler. Makes omission structural, not just convention.
- `getRoomByCode` is the **only** public room function — returns `{roomId, alreadyMember}`, **no room contents**.
- Payment mutations verify `payerUserId`/`payeeUserId === identity`.
- Manual review checklist: verify every room function uses a wrapper or explicit `require*` call.

### BetterAuth on Convex (official pattern)

Per https://better-auth.com/docs/integrations/convex:

1. `convex/auth.config.ts`: `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config` — registers BetterAuth as a Convex auth provider.
2. `convex/betterAuth/convex.config.ts`: `defineComponent("betterAuth")`.
3. `convex/convex.config.ts`: register component via `app.use(betterAuth)`.
4. `convex/betterAuth/auth.ts`: `createAuth(ctx)` → `betterAuth({ appName, baseURL: process.env.SITE_URL, secret: process.env.BETTER_AUTH_SECRET, database: authComponent.adapter(ctx), plugins: [convex({ authConfig })] })`. Add Google social provider.
5. `npx auth generate --config ./convex/betterAuth/auth.ts --output ./convex/betterAuth/schema.ts` — generates auth schema.
6. `convex/betterAuth/adapter.ts`: export `createApi(schema, createAuthOptions)` adapter functions.
7. `convex/http.ts`: `authComponent.registerRoutes(http, createAuth)` — mounts auth routes on Convex.
8. Client: `src/lib/auth-client.ts` → `createAuthClient({ plugins: [convexClient()] })` from `@convex-dev/better-auth/client/plugins`.
9. SvelteKit: `ConvexProvider` (Svelte, via community glue) with `initialToken` from server `getToken`.
10. SvelteKit `/api/auth/[...all]/+server.ts`: thin proxy to Convex auth routes (or community helper's `handler`).

**Env vars via `npx convex env set`** (NOT SvelteKit `.env`): `BETTER_AUTH_SECRET`, `SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
**SvelteKit `.env`**: `PUBLIC_CONVEX_URL`, `PUBLIC_CONVEX_SITE_URL`, `PUBLIC_SITE_URL`, `BOT_API_KEY`.

---

## Task Breakdown

38 atomic commits, dependency-ordered. **Each step must independently pass `pnpm check && pnpm lint && pnpm build` + `npx convex dev` typecheck.** Do NOT run prettier/lint/build mid-implementation — user checks manually after all files done.

| # | Task | Commit message |
|---|------|----------------|
| 1 | ✅ DONE: Add `engines` (node ≥20, pnpm ≥9) + `packageManager` (pnpm@10.8.0) + `packages: ['.']` to workspace | `chore(pkg): add engines and packageManager fields` |
| 2 | Add `@sveltejs/adapter-node`; switch `vite.config.ts` from `adapter-auto` | `chore(build): switch to adapter-node` |
| 3 | Add deps: `convex`, `convex-svelte`, `better-auth`, `@convex-dev/better-auth`, `@mmailaender/convex-better-auth-svelte`; SvelteKit `.env.example` (`PUBLIC_CONVEX_URL`, `PUBLIC_CONVEX_SITE_URL`, `PUBLIC_SITE_URL`); run `pnpm install`, update `pnpm-workspace.yaml` `allowBuilds` if prompted | `chore(deps): add convex better-auth and svelte glue packages` |
| 4 | Exclude `convex/` from `.prettierignore` + eslint `ignores` | `chore(lint): exclude convex dir from prettier and eslint` |
| 5 | `npx convex dev` init → `convex/` scaffold; start local dev backend; set auth env vars via `npx convex env set` (`BETTER_AUTH_SECRET`, `SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | `chore(convex): init convex project and self-host backend` |
| 6 | **Auth foundation + token-bridge spike (GO/NO-GO gate):** `convex/auth.config.ts`, `convex/betterAuth/{convex.config.ts, auth.ts (Google + convex plugin), adapter.ts}`, register component in `convex/convex.config.ts`, `npx auth generate` → schema, mount routes in `convex/http.ts`; SvelteKit `lib/auth-client.ts`, `ConvexProvider`, `/api/auth/[...all]/+server.ts` proxy; `whoami` query. **Verify Google login → `ctx.auth.getUserIdentity()` returns correct user, client- AND server-side.** If community Svelte wrapper fails → manually reimplement thin provider/getToken from official primitives; only if that also fails → pivot to Plan B. | `feat(auth): add convex-hosted better-auth and verify token bridge` |
| 7 | `convex/schema.ts`: profiles, rooms (8-char unique code, status, lastActivity), roomMembers (role), items, itemClaims, contributions, settlementPayments (method+status) | `feat(convex): add database schema` |
| 8 | `convex/authz.ts`: `requireMember/Creator/Contributor` + **`roomQuery`/`roomMutation` wrapper HOF** | `feat(convex): add authorization helpers and wrappers` |
| 9 | `convex/queries.ts`: `getRoomState`, `getRoomByCode` (no contents), `listMyRooms`, `getMyProfile` (all via wrappers) | `feat(convex): add room and profile queries` |
| 10 | `convex/rooms.ts`: `createRoom` (action, retry) + `insertRoom` (mutation, atomic); `joinRoom`; `leaveRoom` (zeroes contribution); `setMemberRole` (creator-only, demotion zeroes contribution); `setContribution` (self-only, cap `≤ total−Σothers`) | `feat(convex): add room contribution and membership mutations` |
| 11 | `convex/claims.ts`: `setClaim` (self, atomic `Σ≤qty`), `deleteClaim` | `feat(convex): add item claim mutations` |
| 12 | `convex/settlement.ts` (`computeSettlement` strict+lenient) + `queries.ts: previewSettlement` (lenient) | `feat(convex): add settlement algorithm and preview query` |
| 13 | `convex/rooms.ts: finalizeSettlement` — single atomic mutation (creator + `status='collecting'` + full-claim + `Σ=total` → compute → insert pending → flip `settling`) | `feat(convex): add atomic finalize settlement mutation` |
| 14 | `convex/rooms.ts`: `markPaid` (one-shot, method immutable, e-wallet re-check), `unmarkPaid`, `confirmPayment` (payee, all-confirmed→settled), `reopenRoom` (zero confirmed → collecting), `deleteRoom` | `feat(convex): add payment and lifecycle mutations` |
| 15 | `convex/http.ts`: add bot HTTP actions (`/api/bot/*`) authenticated via `BOT_API_KEY` env var (alongside auth routes from step 6) | `feat(convex): add bot-facing http actions` |
| 16 | `src/lib/money.ts` + `src/lib/types.ts` | `feat(lib): add money and type helpers` |
| 17 | UI primitives: toast store, `ErrorBoundary`, spinner | `feat(ui): add toast error boundary and spinner` |
| 18 | Root layout: `ConvexProvider` + auth-aware nav | `feat(ui): add convex provider and auth-aware nav` |
| 19 | `/login` (Google OAuth via `authClient.signIn.social`) + `/logout` | `feat(auth): add login and logout routes` |
| 20 | `src/hooks.server.ts`: session resolution (via server getToken) + auth guard (protect all but `/`, `/login`, `/api/auth`) | `feat(auth): resolve session and add auth guard` |
| 21 | `/profile`: display_name, gcash_number, maya_number | `feat(profile): add profile and ewallet edit page` |
| 22 | `ItemEditor.svelte` (name/price/qty, centavos, totals) | `feat(ui): add item editor component` |
| 23 | `MemberList.svelte` (role badges; creator toggles role; contributions visible) + `ContributionInput.svelte` (self-only, capped) | `feat(ui): add member list and contribution input` |
| 24 | `/rooms/new`: ItemEditor + own contribution (default=total if sole payer) → `createRoom` → redirect | `feat(rooms): add create room page` |
| 25 | `/join`: code → `getRoomByCode` → `joinRoom` → redirect | `feat(rooms): add join by code page` |
| 26 | `/rooms/[code]/+page.server.ts` loader + member guard (server Convex token via getToken; client-side `onMount` fallback) | `feat(rooms): add room page loader and member guard` |
| 27 | `ItemClaimGrid.svelte` → `setClaim` (self); live co-claimers; unallocated-item warnings | `feat(ui): add item claim grid` |
| 28 | Room page: `useQuery(getRoomState)` + `useQuery(previewSettlement)`; assemble ItemClaimGrid + MemberList + SettlementPreview | `feat(rooms): render room view with live data` |
| 29 | `SettlementPreview.svelte` (live preview; funding status under/over/exact; unallocated warnings) | `feat(rooms): add live settlement preview` |
| 30 | Lock room → `finalizeSettlement` → `settling`; freeze edits; warn creator of creditors missing e-wallet | `feat(rooms): add lock room to settle` |
| 31 | `SettlementList.svelte` + `PaymentCard.svelte`: available methods (cash always + payee e-wallets); mark paid (one-shot, cash auto-confirms); unmark; confirm; null-e-wallet warning | `feat(payments): add settlement list and payment cards` |
| 32 | Payment progress indicator (X/Y confirmed) — live via `getRoomState` | `feat(rooms): add payment progress indicator` |
| 33 | `/dashboard`: `listMyRooms` (created + joined) | `feat(rooms): add dashboard room list` |
| 34 | `/` landing (auth-aware CTA) | `feat(ui): add landing page` |
| 35 | `/rooms/[code]/settings`: manage roles/contributions, per-member e-wallet view, reopen (zero confirmed), delete, leave | `feat(rooms): add room settings page` |
| 36 | README: self-host Convex (Docker, CORS origin, WS upgrade headers), Convex-hosted BetterAuth + Google OAuth client + redirect URIs, `npx convex env set` for auth secrets, SvelteKit `.env` for `PUBLIC_*`, `BOT_API_KEY` rotation, Plan B honest note, pre-PR checklist incl. `npx convex dev` typecheck | `docs: add setup architecture and deploy guide` |

---

## Risks & Edge Cases

- **Community auth glue** (`@mmailaender/convex-better-auth-svelte`) — highest risk; step 6 spike is go/no-go gate; manual rewiring from official primitives is the first fallback; Plan B (full rewrite on Postgres+Drizzle) is last resort.
- **No RLS** — `roomQuery`/`roomMutation` wrappers enforce `requireMember` structurally; `getRoomByCode` returns no contents; code-review double-checks every function.
- **Finalize race** — resolved by making `finalizeSettlement` a single atomic mutation (read+validate+compute+write in one serializable tx).
- **Convex self-host single-node** — fine for friends-scale; scaling needs proprietary multi-node.
- **Centavos as `number`** with `≤100M` validation — exact integer math ≪ 2^53; avoids bigint serialization risk.
- **Claim over-allocation** — `setClaim` atomic `Σ≤qty`; finalize requires full claims (`Σ=qty`).
- **Contribution overshoot** — `setContribution` cap `≤ total−Σothers`; demotion/leave zeroes contribution.
- **Double-finalize** — mutation gates `status='collecting'` + creator.
- **Recompute vs confirmed** — lock freezes claims/contributions; reopen only if zero confirmed.
- **Cash trust-based** — payer's one-shot mark = confirmed; method immutable (no gcash→cash bypass); `unmarkPaid` for correction.
- **Method/e-wallet consistency** — `markPaid` re-validates payee e-wallet non-null for gcash/maya at mark time.
- **1¢ residue** → largest creditor; `residueCentavos` returned.
- **Code collisions** — 8-char + ≤5 retries in the action; enumeration accepted for v1 (rate-limit future).
- **Item edits after contributions** — allowed in `collecting`; soft UI warning; contributors self-adjust; finalize requires exact `Σ=total`.
- **Null e-wallet** — PaymentCard hides that method + warning; cash always available; creator warned at lock.
- **Abandoned rooms** — `lastActivity` field; manual cleanup / future cron.
- **Stuck pending_confirmation** — accepted for v1 (among friends); v2 dispute/timeout.
- **Bot API key** — `BOT_API_KEY` env var, server-side only.
- **Self-host browser→Convex** — CORS origin + reverse-proxy WS upgrade headers (deploy step).
- `convex/` excluded from lint; `npx convex dev` typecheck in pre-PR checklist.
- TS6 relative imports → `.ts`/`.js` in `src/`.
- Preview (lenient, advisory) vs finalize (strict, authoritative).

---

## Setup Prerequisites (before step 6)

1. **Google OAuth client** in Google Cloud Console (Web application type) with redirect URI matching dev origin. Client ID + Secret set via `npx convex env set GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. **BetterAuth secret:** `npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)`.
3. **Site URL:** `npx convex env set SITE_URL http://localhost:5173`.
4. **Dev backend:** local via `npx convex dev` (no Docker needed for dev). Docker deferred to deploy.
5. **Docker** only needed for production self-hosting, not dev.

---

## Pre-PR Checklist

1. `pnpm check` (svelte-kit sync + svelte-check)
2. `pnpm lint` (prettier --check . && eslint .)
3. `pnpm build` (catches adapter / SSR issues)
4. `npx convex dev` (typechecks Convex functions)
