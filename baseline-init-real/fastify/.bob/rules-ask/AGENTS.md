# Project Documentation Context (Non-Obvious Only)

- `fastify.js` (root) is the actual entry point and public API surface — not a thin re-export; it wires together avvio, the router, all decorators, and lifecycle hooks.
- `lib/symbols.js` is the canonical source of truth for all internal property keys. Understanding it is essential to reading any other `lib/` file.
- `lib/config-validator.js` and `lib/error-serializer.js` are auto-generated — reading their source for logic is misleading; read `build/build-validation.js` and `build/build-error-serializer.js` instead.
- `types/` contains hand-authored TypeScript declarations; `fastify.d.ts` in the root is a re-export barrel. Type tests in `test/types/*.tst.ts` are the canonical usage examples — more up-to-date than docs.
- `test/helper.js` provides important test utilities (`payloadMethod`, `getServerUrl`, `partialDeepStrictEqual`, `assertNoWarning`) that are used throughout the test suite.
- Warning/deprecation code history: `FSTDEP001–FSTDEP025`, `FSTWRN001–FSTWRN002` are retired from prior versions — the active codes live in `lib/warnings.js`.
- `test/internals/` tests `lib/` modules in isolation — useful for understanding individual subsystems without spinning up a full Fastify instance.
