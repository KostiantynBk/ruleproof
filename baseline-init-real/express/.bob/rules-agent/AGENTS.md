# Project Coding Rules (Non-Obvious Only)

- **CommonJS only** — no `import`/`export`, no ESM. Every file starts with `'use strict';`.
- **Never use the global `Buffer`** — ESLint will error. Always: `const { Buffer } = require('node:buffer')`.
- Node built-ins require the `node:` prefix (e.g. `require('node:http')`), but third-party packages do not.
- `eqeqeq allow-null` rule is in effect: `==` is only permitted for null checks; otherwise use `===`.
- Unused function *arguments* are intentionally tolerated (`args: none`) — do not remove them; they are part of public API signatures.
- `MemberExpression` indentation is disabled — do not try to align chained method calls.
- All tests **must** be run with `--require test/support/env` or `NODE_ENV` will not be set and deprecation noise will appear.
- To run a single test file: `npx mocha --require test/support/env test/<file>.js`
- Routing logic lives in the external `router` npm package — do not reimplement routing in `lib/`.
- `lib/utils.js` functions are private API; export them individually by name (no default export object).
