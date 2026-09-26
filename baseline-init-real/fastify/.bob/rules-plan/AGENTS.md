# Project Architecture Rules (Non-Obvious Only)

- **Plugin encapsulation** is handled by `avvio`, not Express-style middleware. The Fastify instance is a tree of child scopes; decorators, hooks, and routes registered inside a plugin are scoped to that branch unless wrapped with `fastify-plugin`.
- **All instance state** is stored under Symbol keys (never plain string keys) sourced from `lib/symbols.js`. This is the encapsulation boundary — external code cannot accidentally access or collide with internals.
- **`lib/config-validator.js`** is a standalone AJV-compiled validator (no runtime AJV). Changing Fastify's init options requires editing the schema in `build/build-validation.js` and re-running `npm run build:validation`.
- **Error architecture**: All internal errors inherit from `@fastify/error`-created constructors with typed `FST_ERR_*` codes. The HTTP status code is baked into the error constructor, not set at throw-site.
- **Route context** (`lib/context.js`) is the shared object attached to every request/reply pair — schema validators, serializers, and hooks are all resolved and cached there at route registration time (not at request time).
- **`lib/validation.js`** compiles AJV validators and fast-json-stringify serializers at route registration; the compiled functions are stored in the route context. This is critical for performance — avoid mutating route options after registration.
- **Lifecycle hooks** in `lib/hooks.js` run in registration order per-scope; hook runners (`onRequestHookRunner`, `preParsingHookRunner`, etc.) are imported individually — each is a separate optimised runner, not a generic loop.
- **Two test categories**: `test/**/*.test.js` (unit, run by `borp`) and `test/types/**/*.tst.ts` (type, run by `tstyche`). They use entirely different runners and failure modes.
- **HTTP/2 and HTTPS** code paths diverge early in `fastify.js` / `lib/server.js` based on options — plan changes to server creation carefully to avoid breaking one of the three server modes (http, https, http2).
