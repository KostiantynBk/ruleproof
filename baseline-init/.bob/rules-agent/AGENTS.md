# Project Coding Rules (Non-Obvious Only)

- Use `clock.now()` from `src/clock.js` for all timestamps — never `new Date()` directly. Tests stub `clock.now` to fix time.
- All domain errors must be `new AppError(code, message)` from `src/errors.js`. Tests assert on `err.code`, not `err.message`.
- Business functions must be pure: accept an order, return `{ ...order, ...changes }`. Never mutate the input object.
- Monetary values are always integers in cents (`total_cents`), never floats.
- `src/audit.js` and `src/payments.js` are stubs; don't add real logic there without knowing the integration contract.
- CommonJS only — no `import`/`export`.
