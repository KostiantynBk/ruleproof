# Project Documentation Context (Non-Obvious Only)

- `src/clock.js` is a seam for time injection, not a utility wrapper — tests mutate `clock.now` directly.
- `src/audit.js` and `src/payments.js` are intentional stubs; the module API surface is defined but bodies are empty.
- There is no framework, bundler, or linter — the project is plain Node.js with zero dependencies.
- The test runner is Node's built-in `node:test` (v18+), not Jest or Mocha.
