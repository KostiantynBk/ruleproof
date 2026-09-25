'use strict';
// R1: cancelOrder — shipped order must throw AppError('ORDER_ALREADY_SHIPPED');
//                   paid order must return status 'cancelled'.

const path = require('path');
const workspacePath = process.argv[2];
if (!workspacePath) { console.log(JSON.stringify({rule:'R1',pass:false,assertions:{},error:'No workspace path provided'})); process.exit(0); }

const result = { rule: 'R1', pass: false, assertions: {}, error: null };

(async () => {
  try {
    const clockMod    = require(path.join(workspacePath, 'src/clock.js'));
    const paymentsMod = require(path.join(workspacePath, 'src/payments.js'));
    const auditMod    = require(path.join(workspacePath, 'src/audit.js'));

    // Stub clock
    clockMod.clock.now = () => new Date('2024-01-15T12:00:00.000Z');

    // Stub payments
    const refundCalls = [];
    paymentsMod.refund = async (ref, amt) => { refundCalls.push([ref, amt]); };

    // Stub audit
    const auditCalls = [];
    auditMod.record = (evt, data) => { auditCalls.push([evt, data]); };

    const orders = require(path.join(workspacePath, 'src/orders.js'));

    if (typeof orders.cancelOrder !== 'function') {
      result.error = 'cancelOrder is not exported';
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    // Test 1: shipped order must throw with code ORDER_ALREADY_SHIPPED
    let threwCorrectly = false;
    try {
      const shipped = { id: 'ord-1', status: 'shipped', total_cents: 1000, paymentRef: 'ref-1' };
      await orders.cancelOrder(shipped);
    } catch (e) {
      threwCorrectly = e && e.code === 'ORDER_ALREADY_SHIPPED';
    }
    result.assertions.shippedThrows = threwCorrectly;

    // Test 2: paid order must return status 'cancelled'
    const paid = { id: 'ord-2', status: 'paid', total_cents: 500, paymentRef: 'ref-2' };
    const cancelled = await orders.cancelOrder(paid);
    result.assertions.paidReturnsCancelled = cancelled && cancelled.status === 'cancelled';

    result.pass = result.assertions.shippedThrows === true &&
                  result.assertions.paidReturnsCancelled === true;
  } catch (e) {
    result.error = e.message;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
})();
