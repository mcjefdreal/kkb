# AGENTS.md

SvelteKit minimal app (Svelte 5, TypeScript, Tailwind v4, Vite). Scaffolded
with `sv create`; no tests, no CI, no deploy target configured yet.

## Commands

- `pnpm dev` — Vite dev server.
- `pnpm build` — production build (uses `@sveltejs/adapter-auto`).
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
- **`.npmrc` has `engine-strict=true`.** No `engines` field in `package.json`
  yet; add one intentionally rather than letting pnpm warn.
- **Adapter is `adapter-auto`.** If deploying to an unsupported host, swap
  adapters in `vite.config.ts` (see comment there).

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

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
