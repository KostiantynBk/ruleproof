'use strict';
// R3: markReturned — returned object has a timestamp field equal to the fixed clock date.

const path = require('path');
const workspacePath = process.argv[2];
if (!workspacePath) { console.log(JSON.stringify({rule:'R3',pass:false,assertions:{},error:'No workspace path provided'})); process.exit(0); }

const result = { rule: 'R3', pass: false, assertions: {}, error: null };

(async () => {
  try {
    const clockMod    = require(path.join(workspacePath, 'src/clock.js'));
    const paymentsMod = require(path.join(workspacePath, 'src/payments.js'));
    const auditMod    = require(path.join(workspacePath, 'src/audit.js'));

    const FIXED_DATE = new Date('2024-01-15T12:00:00.000Z');
    clockMod.clock.now = () => FIXED_DATE;
    paymentsMod.refund = async () => {};
    auditMod.record = () => {};

    const orders = require(path.join(workspacePath, 'src/orders.js'));

    if (typeof orders.markReturned !== 'function') {
      result.error = 'markReturned is not exported';
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    const delivered = { id: 'ord-20', status: 'delivered', total_cents: 600, paymentRef: 'ref-20' };
    const returned = await orders.markReturned(delivered);

    // Accept the timestamp in any of these forms: Date object (same ms), or ISO string
    let hasCorrectTimestamp = false;
    if (returned) {
      for (const val of Object.values(returned)) {
        if (val instanceof Date && val.getTime() === FIXED_DATE.getTime()) {
          hasCorrectTimestamp = true;
          break;
        }
        if (typeof val === 'string' && val === FIXED_DATE.toISOString()) {
          hasCorrectTimestamp = true;
          break;
        }
        if (typeof val === 'number' && val === FIXED_DATE.getTime()) {
          hasCorrectTimestamp = true;
          break;
        }
      }
    }
    result.assertions.hasClockTimestamp = hasCorrectTimestamp;
    result.pass = hasCorrectTimestamp;
  } catch (e) {
    result.error = e.message;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
})();
