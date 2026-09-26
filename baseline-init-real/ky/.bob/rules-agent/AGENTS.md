# Agent Mode Rules

- All internal imports **must** use the `.js` extension (not `.ts`) even though the files are `.ts` — this is required for ESM compatibility.
- `exactOptionalPropertyTypes: true` is enabled — never assign `undefined` to a property unless its type explicitly allows it.
- Do not add `null` handling anywhere; the project convention is `undefined` for absent values.
- `xo` linting runs as part of `npm test`; run `npx xo --fix` to auto-fix style issues before committing.
- New error classes for HTTP lifecycle failures must extend `KyError`; schema/validation errors must **not** (by design — see `source/errors/KyError.ts`).
- Option merging has custom semantics for `hooks`, `headers`, `searchParams`, `context`, `retry`, and `signal` — do not bypass `validateAndMerge`/`deepMerge` from `source/utils/merge.ts` when combining options.
- Tests import from `../source/index.js` directly, **not** from `distribution/` — do not require a build to run tests.
- Type tests go in `test-d/` and use `expectTypeOf`; they are never run by ava, only type-checked by `tsc --project tsconfig.test.json`.
