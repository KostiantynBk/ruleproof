# Project Documentation Context (Non-Obvious Only)

- This is the **Express v5** source repo — some behaviours differ from v4 (e.g. `Router` is an external package, not bundled).
- `lib/application.js` exports a plain object used as a prototype mixin, not a class — `app` is a function with properties mixed in via `merge-descriptors`.
- The `Router` and `Route` exports come from the external `router` package, not from any file inside `lib/`.
- `express.json`, `express.raw`, `express.text`, `express.urlencoded` are re-exports from `body-parser` — their implementation is not in this repo.
- `express.static` re-exports `serve-static` — also not in this repo.
- Test helpers in `test/support/` are not documented but are used across many test files.
