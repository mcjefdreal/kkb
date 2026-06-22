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
- `src/lib/` — `$lib` alias root; currently empty except for `assets/`.
- `src/app.html`, `src/app.d.ts` — SvelteKit shell and ambient types.
- `static/` — served as-is (Prettier-ignored).
- `.svelte-kit/` — generated; do not edit, do not commit.

## Style

- Tabs, single quotes, no trailing commas, 100-col width (`.prettierrc`).
- ESLint uses `typescript-eslint` recommended + `svelte` recommended;
  `no-undef` is off (TS handles it). `eslint-config-prettier` last, so
  Prettier wins on formatting disputes.

## Pre-PR checklist

1. `pnpm check`
2. `pnpm lint`
3. `pnpm build` (catches adapter / SSR issues that `dev` hides)
