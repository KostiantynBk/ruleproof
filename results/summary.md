# Ruleproof Results

Generated: 2026-09-25T17:51:28.956Z  
Bob version: 2.0.4  
Max cost: 0.3 coins  
Repeats: 3  
Total cost: 1.8782 coins  

| Rule | Layer | p_without | p_with | Verdict |
|------|-------|----------:|-------:|---------|
| R1 | project | 0% | 100% | **KEEP** |
| R2 | project | 0% | 100% | **KEEP** |
| R3 | project | 100% | 100% | **REDUNDANT** |
| R4 | project | 67% | 100% | **REDUNDANT** |
| R5 | project | 0% | 100% | **KEEP** |

## Details

### R1

> When cancelling or modifying an order, always check order.status === 'shipped' first and throw AppError('ORDER_ALREADY_SHIPPED') before any further logic.

Verdict: **KEEP**  p_without=0%  p_with=100%

| cond | run | pass | cost | error |
|------|-----|------|------|-------|
| without | 0 | ❌ | 0.0595 coins |  |
| without | 1 | ❌ | 0.0805 coins |  |
| without | 2 | ❌ | 0.0799 coins |  |
| with | 0 | ✅ | 0.0603 coins |  |
| with | 1 | ✅ | 0.0605 coins |  |
| with | 2 | ✅ | 0.0606 coins |  |

### R2

> Always call audit.record(eventName, data) — never audit.log(). The data object must include orderId, and eventName must follow the pattern 'order.<verb>'.

Verdict: **KEEP**  p_without=0%  p_with=100%

| cond | run | pass | cost | error |
|------|-----|------|------|-------|
| without | 0 | ❌ | 0.0591 coins |  |
| without | 1 | ❌ | 0.0591 coins |  |
| without | 2 | ❌ | 0.0592 coins |  |
| with | 0 | ✅ | 0.0606 coins |  |
| with | 1 | ✅ | 0.0605 coins |  |
| with | 2 | ✅ | 0.0606 coins |  |

### R3

> Always use clock.now() for all timestamps — never Date.now(). The clock module is injected specifically to allow time to be frozen in tests.

Verdict: **REDUNDANT**  p_without=100%  p_with=100%

| cond | run | pass | cost | error |
|------|-----|------|------|-------|
| without | 0 | ✅ | 0.0601 coins |  |
| without | 1 | ✅ | 0.0594 coins |  |
| without | 2 | ✅ | 0.0599 coins |  |
| with | 0 | ✅ | 0.0603 coins |  |
| with | 1 | ✅ | 0.0603 coins |  |
| with | 2 | ✅ | 0.0603 coins |  |

### R4

> Issue all refunds via payments.refund(order.paymentRef, amountCents). Never read from or write to total_cents directly to perform a refund.

Verdict: **REDUNDANT**  p_without=67%  p_with=100%

| cond | run | pass | cost | error |
|------|-----|------|------|-------|
| without | 0 | ✅ | 0.0807 coins |  |
| without | 1 | ✅ | 0.0806 coins |  |
| without | 2 | ❌ | 0.0593 coins | audit.log is not a function |
| with | 0 | ✅ | 0.0599 coins |  |
| with | 1 | ✅ | 0.0598 coins |  |
| with | 2 | ✅ | 0.0609 coins |  |

### R5

> Use Math.floor (not Math.round) when calculating partial refund amounts in cents. Math.round can produce a 1-cent over-refund that causes reconciliation failures.

Verdict: **KEEP**  p_without=0%  p_with=100%

| cond | run | pass | cost | error |
|------|-----|------|------|-------|
| without | 0 | ❌ | 0.0592 coins |  |
| without | 1 | ❌ | 0.0591 coins |  |
| without | 2 | ❌ | 0.0590 coins |  |
| with | 0 | ✅ | 0.0597 coins |  |
| with | 1 | ✅ | 0.0598 coins |  |
| with | 2 | ✅ | 0.0597 coins |  |
