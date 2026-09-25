'use strict';
// R4: refundOrder — payments.refund called with (order.paymentRef, amountCents)
//     AND order's total_cents is unchanged.

const path = require('path');
const workspacePath = process.argv[2];
if (!workspacePath) { console.log(JSON.stringify({rule:'R4',pass:false,assertions:{},error:'No workspace path provided'})); process.exit(0); }

const result = { rule: 'R4', pass: false, assertions: {}, error: null };

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

    if (typeof orders.refundOrder !== 'function') {
      result.error = 'refundOrder is not exported';
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    const order = { id: 'ord-30', status: 'paid', total_cents: 1500, paymentRef: 'ref-30' };
    const amountCents = 300;
    const returned = await orders.refundOrder(order, amountCents);

    // payments.refund must be called with (paymentRef, amountCents)
    const refundedCorrectly = refundCalls.some(([ref, amt]) =>
      ref === 'ref-30' && amt === amountCents
    );
    result.assertions.paymentsRefundCalled = refundedCorrectly;

    // total_cents must be unchanged.
    // If the function returns an object that has total_cents, that value must
    // equal the original. We do NOT fall back to checking the input object —
    // that would let a mutating-return implementation slip through.
    let totalIntact;
    if (returned != null && Object.prototype.hasOwnProperty.call(returned, 'total_cents')) {
      totalIntact = returned.total_cents === 1500;
    } else {
      // Function returned nothing useful; check original wasn't mutated either.
      totalIntact = order.total_cents === 1500;
    }
    result.assertions.totalCentsUnchanged = totalIntact;

    result.pass = result.assertions.paymentsRefundCalled === true &&
                  result.assertions.totalCentsUnchanged === true;
  } catch (e) {
    result.error = e.message;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
})();
