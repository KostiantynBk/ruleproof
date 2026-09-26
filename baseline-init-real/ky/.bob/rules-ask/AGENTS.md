# Ask Mode Rules

- `distribution/` is gitignored build output — always look in `source/` for actual implementation.
- `test-d/` is for TypeScript type tests only (compiled, not executed); runtime tests are in `test/`.
- The `xo` linter wraps ESLint + Prettier with opinionated defaults; project-level overrides are in `package.json` under `"xo"`.
- `SchemaValidationError` is intentionally outside the `KyError` hierarchy — this is by design, not an oversight.
- `replaceOption()` (exported from the package) is the public API for replacing merged options in `ky.extend()` instead of appending/merging them.
