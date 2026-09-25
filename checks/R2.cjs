'use strict';
// R2: markDelivered — returns status 'delivered' AND audit.record called with
//     ('order.delivered', object containing orderId).

const path = require('path');
const workspacePath = process.argv[2];
if (!workspacePath) { console.log(JSON.stringify({rule:'R2',pass:false,assertions:{},error:'No workspace path provided'})); process.exit(0); }

const result = { rule: 'R2', pass: false, assertions: {}, error: null };

(async () => {
  try {
    const clockMod    = require(path.join(workspacePath, 'src/clock.js'));
    const paymentsMod = require(path.join(workspacePath, 'src/payments.js'));
    const auditMod    = require(path.join(workspacePath, 'src/audit.js'));

    clockMod.clock.now = () => new Date('2024-01-15T12:00:00.000Z');
    paymentsMod.refund = async () => {};

    const auditCalls = [];
    auditMod.record = (evt, data) => { auditCalls.push([evt, data]); };

    const orders = require(path.join(workspacePath, 'src/orders.js'));

    if (typeof orders.markDelivered !== 'function') {
      result.error = 'markDelivered is not exported';
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    const shipped = { id: 'ord-10', status: 'shipped', total_cents: 800, paymentRef: 'ref-10' };
    const delivered = await orders.markDelivered(shipped);

    result.assertions.statusDelivered = delivered && delivered.status === 'delivered';

    const auditCall = auditCalls.find(([evt, data]) =>
      evt === 'order.delivered' && data && data.orderId !== undefined
    );
    result.assertions.auditRecordCalled = auditCall !== undefined;

    result.pass = result.assertions.statusDelivered === true &&
                  result.assertions.auditRecordCalled === true;
  } catch (e) {
    result.error = e.message;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
})();
