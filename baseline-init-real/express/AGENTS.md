# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project
Express.js v5 — a Node.js HTTP framework. Pure CommonJS (`'use strict'`; `require`/`module.exports`). No TypeScript, no bundler.

## Commands
```sh
npm test                     # run full suite (mocha --check-leaks)
npm run lint                 # eslint
npm run lint:fix             # eslint --fix

# Run a single test file:
npx mocha --require test/support/env test/res.send.js
```
`test/support/env` **must** be `--require`d for every mocha invocation — it sets `NODE_ENV=test` and suppresses deprecation warnings from body-parser/express.

## Code Style (enforced by ESLint)
- 2-space indentation; `MemberExpression` indent is **off** (chained calls need not align).
- `eqeqeq` with `allow-null` — `==` is allowed only for `null` comparisons; use `===` everywhere else.
- `no-unused-vars`: `args: none` — unused function parameters are tolerated; unused variables are errors.
- **Never use the global `Buffer`**. Import it explicitly: `const { Buffer } = require('node:buffer')`.
- Node built-ins must use the `node:` protocol prefix (e.g. `require('node:http')`).
- Files must end with a newline; no trailing spaces.

## Architecture
- `index.js` → `lib/express.js` (entry, exports all public API)
- `lib/application.js` — app prototype, mixed into the function returned by `createApplication()`
- `lib/request.js` / `lib/response.js` — req/res prototypes, extended from Node's `IncomingMessage`/`ServerResponse`
- `lib/utils.js` — internal helpers; **not part of public API**
- `lib/view.js` — template rendering
- Routing is delegated entirely to the external `router` npm package (v2).

## Testing
- Framework: **Mocha** + **supertest** (HTTP assertions) + `node:assert`.
- Test files live directly in `test/` and `test/acceptance/`; no subdirectory nesting for unit tests.
- `test/support/utils.js` and `test/support/tmpl.js` provide shared test helpers.
- Coverage: `npm run test-cov` (HTML report) or `npm run test-ci` (lcov).

## npm Notes
- `.npmrc` sets `ignore-scripts=true` and `package-lock=false` — no lock file is committed.
