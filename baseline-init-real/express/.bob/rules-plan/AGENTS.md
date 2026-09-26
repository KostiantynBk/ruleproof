# Project Architecture Rules (Non-Obvious Only)

- `createApplication()` returns a **function** (not a class instance) and mixes in `EventEmitter.prototype` and `lib/application.js` via `merge-descriptors` — property descriptors are copied, not assigned.
- `app.request` and `app.response` are `Object.create(req/res)` — each app instance gets its own prototype chain; patching `req`/`res` on one app does not affect another.
- Routing is fully delegated to the external `router` package (v2) — there is no internal router implementation to modify.
- `lib/view.js` is the only template-engine abstraction layer; view lookup and caching live there.
- `.npmrc` has `ignore-scripts=true` — post-install hooks never run; any setup requiring scripts must be done manually.
- The package does **not** use a lock file (`package-lock=false`) — dependency versions are governed by semver ranges in `package.json`.
