# Plan Mode Rules

- `Ky.create()` is a static factory that returns a `ResponsePromise` — the `Ky` class is never instantiated externally.
- Option merging (`source/utils/merge.ts`) has non-trivial special cases per key (`hooks` append, `headers` case-insensitive merge with deletion markers, `searchParams` accumulate with deletion markers, `context` shallow merge, `retry` number↔object coercion, `signal` uses `AbortSignal.any`). Any feature touching option composition must account for all of these.
- The `deletedParametersSymbol` internal symbol is attached directly to `URLSearchParams` instances as a side-channel to track removed keys across merge layers — a non-standard pattern.
- `workerThreads: false` in ava config is load-bearing for tests that use shared server state; do not re-enable it.
- `test-d/` type tests and `test/` runtime tests are separate compile units — architectural changes must keep both passing independently.
- No runtime dependencies — all utilities are hand-rolled; do not introduce external runtime packages.
