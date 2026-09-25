# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- Node.js, CommonJS (`require`/`module.exports`) — no ESM
- No external dependencies (pure Node built-ins)
- No TypeScript, no linter config

## Commands

```bash
npm test                             # run all tests
node --test test/orders.test.js      # run a single test file
```

`npm test` is just `node --test` — it discovers `**/*.test.js` files automatically.

## Architecture

- `src/clock.js` — injectable clock singleton (`clock.now()`). **Never call `new Date()` directly in business logic**; always use `clock.now()` so tests can stub time.
- `src/errors.js` — `AppError(code, message)`: all domain errors must use this class; error codes are checked by tests via `err.code`.
- `src/audit.js` / `src/payments.js` — stubs; not yet implemented but imported by `orders.js`.
- Business functions are **pure transforms**: they accept an order object and return a new one (`{ ...order, ... }`). They never mutate.

## Code Style

- CommonJS modules throughout.
- Monetary amounts stored as `total_cents` (integer, cents) — never as floats.
- Error codes are `SCREAMING_SNAKE_CASE` strings (e.g. `ORDER_NOT_PENDING`).
- No `async`/`await` in business logic (`orders.js`); async is only in `payments.js`.

## Testing Patterns

- Uses Node's built-in `node:test` + `node:assert/strict` — no Jest/Mocha.
- Clock is stubbed by overwriting `clock.now` directly: `clock.now = () => FIXED_DATE;` at top of test file (applies globally for all tests in that file).
- Tests verify **non-mutation** explicitly (check original object after call).
- `assert.throws` callbacks must `return true` to signal the assertion passed.
