# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

`ky` — tiny ESM-only HTTP client built on the Fetch API. Pure TypeScript, no runtime dependencies. Source in `source/`, output to `distribution/` (not committed).

## Commands

```sh
npm test              # xo lint → build → tsc type-check (test-d/) → ava tests
npm run build         # del distribution && tsc --project tsconfig.dist.json
npx ava test/main.ts  # run a single test file
npx ava -- --match '*some title*'  # run a single test by title
```

> `npm test` runs `xo` (lint), then `build`, then `tsc --project tsconfig.test.json` (type-checks `test-d/` only), then `ava`. All four must pass.

## Key conventions (from AGENTS.human.md)

- Prefer `undefined` for absent values. **Do not add special handling for `null`.**

## Code style

- ESM only — all internal imports use the `.js` extension even for `.ts` source files (e.g. `import {Ky} from './core/Ky.js'`).
- Tabs for indentation (`.editorconfig`), LF line endings.
- `exactOptionalPropertyTypes: true` in tsconfig — treat optional properties strictly; do not assign `undefined` to a property unless its type explicitly includes `undefined`.
- `xo` enforces style. Several rules are disabled project-wide (see `package.json` `xo.rules`): `@typescript-eslint/naming-convention`, `unicorn/filename-case`, `promise/prefer-await-to-then`, etc.
- Type-only imports use `import type { … }`.

## Architecture

- `source/core/Ky.ts` — single `Ky` class; `Ky.create()` is the main entry point that returns a `ResponsePromise`.
- `source/utils/merge.ts` — deep merge for options; hooks/headers/searchParams/context/retry each have special merge semantics. Use `replaceOption()` (exported from index) to replace instead of merge.
- `source/errors/` — error hierarchy: `KyError` (base for HTTP lifecycle errors) → `HTTPError`, `NetworkError`, `TimeoutError`, `ResponseSizeError`, `ForceRetryError`. `SchemaValidationError` intentionally does **not** extend `KyError`.
- `test-d/` — type-only tests compiled by `tsc --project tsconfig.test.json` (no ava); use `expectTypeOf` from `expect-type`.
- `test/helpers/create-http-test-server.ts` — spins up a real Express server on a random port; call with `t` (ava `ExecutionContext`) to auto-teardown, or manage `server.close()` manually.

## Testing notes

- Ava is configured with `workerThreads: false` and `--import=tsx/esm`; tests import directly from `../source/index.js` (not the built `distribution/`).
- Browser tests (`test/browser.ts`, `test/with-page.ts`) require Playwright and use `PWDEBUG=1 ava --timeout=2m` for debug mode (`npm run debug`).
- `test-d/` files are never run by ava — they are only type-checked by `tsc`.
