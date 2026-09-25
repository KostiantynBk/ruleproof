#!/usr/bin/env node
// checks/selftest.mjs
// For each rule: copies samples/harbor-orders to a temp dir, runs the check
// (must pass=false because the function doesn't exist yet), then appends the
// reference implementation to the temp orders.js and runs again (must pass=true).

import { cp, mkdtemp, appendFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_SRC = resolve(__dirname, '../samples/harbor-orders');
const CHECKS_DIR = __dirname;

// ---------------------------------------------------------------------------
// Reference implementations (appended to orders.js in the temp workspace)
// Each must exercise all assertions in the corresponding check.
// ---------------------------------------------------------------------------
const IMPLEMENTATIONS = {
  R1: `
async function cancelOrder(order) {
  if (order.status === 'shipped') {
    throw new AppError('ORDER_ALREADY_SHIPPED', 'Order has already been shipped');
  }
  if (order.status === 'paid') {
    await payments.refund(order.paymentRef, order.total_cents);
  }
  return { ...order, status: 'cancelled', cancelledAt: clock.now() };
}
module.exports.cancelOrder = cancelOrder;
`,

  R2: `
async function markDelivered(order) {
  const result = { ...order, status: 'delivered', deliveredAt: clock.now() };
  audit.record('order.delivered', { orderId: order.id });
  return result;
}
module.exports.markDelivered = markDelivered;
`,

  R3: `
async function markReturned(order) {
  return { ...order, status: 'returned', returnedAt: clock.now() };
}
module.exports.markReturned = markReturned;
`,

  R4: `
async function refundOrder(order, amountCents) {
  await payments.refund(order.paymentRef, amountCents);
  return order;
}
module.exports.refundOrder = refundOrder;
`,

  // Bad R4: calls payments.refund correctly but mutates total_cents in the return value.
  // The check must produce pass=false for this implementation.
  R4_BAD: `
async function refundOrder(order, amountCents) {
  await payments.refund(order.paymentRef, amountCents);
  return { ...order, total_cents: order.total_cents - amountCents };
}
module.exports.refundOrder = refundOrder;
`,

  R5: `
async function partialRefund(order, percent) {
  const amount = Math.floor(order.total_cents * percent / 100);
  await payments.refund(order.paymentRef, amount);
  return order;
}
module.exports.partialRefund = partialRefund;
`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function runCheck(checkFile, workspacePath) {
  const result = spawnSync(process.execPath, [checkFile, workspacePath], {
    encoding: 'utf8',
  });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  if (!stdout) {
    return { rule: null, pass: false, error: stderr || 'No output from check' };
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return { rule: null, pass: false, error: `Bad JSON: ${stdout}` };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const rules = ['R1', 'R2', 'R3', 'R4', 'R5'];
const rows = [];
let allPassed = true;

for (const rule of rules) {
  const checkFile = join(CHECKS_DIR, `${rule}.cjs`);
  let tmpDir = null;
  try {
    // 1. Copy sample to temp dir
    tmpDir = await mkdtemp(join(tmpdir(), `selftest-${rule}-`));
    await cp(SAMPLE_SRC, tmpDir, { recursive: true });

    // 2. Run check before adding implementation — must be pass=false
    const before = runCheck(checkFile, tmpDir);
    const beforeOk = before.pass === false;

    // 3. Append reference implementation
    const ordersJs = join(tmpDir, 'src', 'orders.js');
    await appendFile(ordersJs, IMPLEMENTATIONS[rule], 'utf8');

    // 4. Run check after — must be pass=true
    const after = runCheck(checkFile, tmpDir);
    const afterOk = after.pass === true;

    const passed = beforeOk && afterOk;
    if (!passed) allPassed = false;

    rows.push({
      rule,
      beforePass: before.pass,
      beforeOk,
      afterPass: after.pass,
      afterOk,
      passed,
      beforeError: before.error || null,
      afterError: after.error || null,
    });
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Extra case: R4_BAD — payments.refund called correctly but total_cents mutated
// in the returned object. The check must produce pass=false.
// ---------------------------------------------------------------------------
{
  const checkFile = join(CHECKS_DIR, 'R4.cjs');
  let tmpDir = null;
  let r4BadPassed = false;
  let r4BadError = null;
  let r4BadActual = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'selftest-R4_BAD-'));
    await cp(SAMPLE_SRC, tmpDir, { recursive: true });
    const ordersJs = join(tmpDir, 'src', 'orders.js');
    await appendFile(ordersJs, IMPLEMENTATIONS.R4_BAD, 'utf8');
    const result = runCheck(checkFile, tmpDir);
    r4BadActual = result.pass;
    // pass=false is the expected outcome for the bad implementation
    r4BadPassed = result.pass === false;
    if (!r4BadPassed) allPassed = false;
  } catch (e) {
    r4BadError = e.message;
    allPassed = false;
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
  rows.push({
    rule: 'R4_BAD',
    // no "before" phase for this case — we only test the bad implementation
    beforePass: '(skipped)',
    beforeOk: true,
    afterPass: r4BadActual,
    // afterOk means: the check correctly rejected the bad implementation
    afterOk: r4BadPassed,
    passed: r4BadPassed,
    beforeError: null,
    afterError: r4BadError,
  });
}

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------
console.log('\n=== selftest summary ===\n');
const col = (s, w) => String(s).padEnd(w);
const header = `${col('Rule',8)} ${col('before=false',14)} ${col('after=true / bad=false',24)} ${col('RESULT',8)}`;
console.log(header);
console.log('-'.repeat(header.length));
for (const r of rows) {
  const beforeMark = r.rule === 'R4_BAD'
    ? '(skipped)    '
    : (r.beforeOk ? '✓' : `✗ (got pass=${r.beforePass}${r.beforeError ? ', err: '+r.beforeError : ''})`);
  const afterLabel = r.rule === 'R4_BAD'
    ? `bad→pass=${r.afterPass} (want false)`
    : (r.afterOk ? '✓' : `✗ (got pass=${r.afterPass}${r.afterError ? ', err: '+r.afterError : ''})`);
  const result = r.passed ? 'PASS' : 'FAIL';
  console.log(`${col(r.rule,8)} ${col(beforeMark,14)} ${col(afterLabel,24)} ${result}`);
}
console.log();
console.log(allPassed ? 'All selftests passed.' : 'SOME SELFTESTS FAILED.');
process.exit(allPassed ? 0 : 1);
