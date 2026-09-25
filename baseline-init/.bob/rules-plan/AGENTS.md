# Project Architecture Rules (Non-Obvious Only)

- The clock singleton (`src/clock.js`) is the only shared mutable state — all time-stamping goes through it to allow deterministic tests.
- Domain functions are intentionally stateless pure transforms; side-effects (payments, audit) are delegated to stub modules and must stay out of business logic.
- `AppError.code` is the primary contract between business logic and callers/tests — message text is incidental.
- There is no persistence layer or HTTP layer yet; all modules are pure logic or stubs.
- Discount validation rule: `1 ≤ percent ≤ 50` (0 and negatives rejected; 51+ rejected; 50 is allowed).
