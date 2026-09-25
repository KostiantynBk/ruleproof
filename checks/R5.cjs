'use strict';
// R5: partialRefund — for total_cents=999, percent=33,
//     payments.refund called with Math.floor(999*33/100) = 329.

const path = require('path');
const workspacePath = process.argv[2];
if (!workspacePath) { console.log(JSON.stringify({rule:'R5',pass:false,assertions:{},error:'No workspace path provided'})); process.exit(0); }

const result = { rule: 'R5', pass: false, assertions: {}, error: null };

(async () => {
  try {
    const clockMod    = require(path.join(workspacePath, 'src/clock.js'));
    const paymentsMod = require(path.join(workspacePath, 'src/payments.js'));
    const auditMod    = require(path.join(workspacePath, 'src/audit.js'));

    clockMod.clock.now = () => new Date('2024-01-15T12:00:00.000Z');
    auditMod.record = () => {};

    const refundCalls = [];
    paymentsMod.refund = async (ref, amt) => { refundCalls.push([ref, amt]); };

    const orders = require(path.join(workspacePath, 'src/orders.js'));

    if (typeof orders.partialRefund !== 'function') {
      result.error = 'partialRefund is not exported';
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    const order = { id: 'ord-40', status: 'paid', total_cents: 999, paymentRef: 'ref-40' };
    await orders.partialRefund(order, 33);

    // Expected: Math.floor(999 * 33 / 100) = Math.floor(329.67) = 329
    const EXPECTED = 329;
    const calledWithFloor = refundCalls.some(([, amt]) => amt === EXPECTED);
    result.assertions.refundAmountIsFloor = calledWithFloor;
    result.assertions.expectedAmount = EXPECTED;
    result.assertions.actualAmounts = refundCalls.map(([, amt]) => amt);

    result.pass = calledWithFloor;
  } catch (e) {
    result.error = e.message;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
})();
