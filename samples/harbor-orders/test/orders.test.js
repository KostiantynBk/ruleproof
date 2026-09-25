const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clock } = require('../src/clock');
const { markPaid, markShipped, applyDiscount } = require('../src/orders');

const FIXED_DATE = new Date('2024-01-15T10:00:00.000Z');

function stubClock() {
  clock.now = () => FIXED_DATE;
}

stubClock();

// markPaid

test('markPaid returns paid order with paidAt timestamp', () => {
  const order = { id: '1', status: 'pending', total_cents: 1000 };
  const result = markPaid(order, 'ref-abc');
  assert.equal(result.status, 'paid');
  assert.equal(result.paymentRef, 'ref-abc');
  assert.deepEqual(result.paidAt, FIXED_DATE);
  assert.equal(result.id, '1');
  assert.equal(result.total_cents, 1000);
});

test('markPaid does not mutate the original order', () => {
  const order = { id: '2', status: 'pending', total_cents: 500 };
  markPaid(order, 'ref-xyz');
  assert.equal(order.status, 'pending');
});

test('markPaid throws ORDER_NOT_PENDING when status is paid', () => {
  const order = { id: '3', status: 'paid', total_cents: 1000 };
  assert.throws(() => markPaid(order, 'ref-abc'), (err) => {
    assert.equal(err.code, 'ORDER_NOT_PENDING');
    return true;
  });
});

test('markPaid throws ORDER_NOT_PENDING when status is shipped', () => {
  const order = { id: '4', status: 'shipped', total_cents: 1000 };
  assert.throws(() => markPaid(order, 'ref-abc'), (err) => {
    assert.equal(err.code, 'ORDER_NOT_PENDING');
    return true;
  });
});

// markShipped

test('markShipped returns shipped order with shippedAt timestamp', () => {
  const order = { id: '5', status: 'paid', total_cents: 1000 };
  const result = markShipped(order, 'TRACK-001');
  assert.equal(result.status, 'shipped');
  assert.equal(result.trackingNumber, 'TRACK-001');
  assert.deepEqual(result.shippedAt, FIXED_DATE);
  assert.equal(result.id, '5');
});

test('markShipped does not mutate the original order', () => {
  const order = { id: '6', status: 'paid', total_cents: 800 };
  markShipped(order, 'TRACK-002');
  assert.equal(order.status, 'paid');
});

test('markShipped throws ORDER_NOT_PAID when status is pending', () => {
  const order = { id: '7', status: 'pending', total_cents: 1000 };
  assert.throws(() => markShipped(order, 'TRACK-003'), (err) => {
    assert.equal(err.code, 'ORDER_NOT_PAID');
    return true;
  });
});

test('markShipped throws ORDER_NOT_PAID when status is shipped', () => {
  const order = { id: '8', status: 'shipped', total_cents: 1000 };
  assert.throws(() => markShipped(order, 'TRACK-004'), (err) => {
    assert.equal(err.code, 'ORDER_NOT_PAID');
    return true;
  });
});

// applyDiscount

test('applyDiscount reduces total_cents correctly', () => {
  const order = { id: '9', status: 'pending', total_cents: 1000 };
  const result = applyDiscount(order, 10);
  assert.equal(result.total_cents, 900);
});

test('applyDiscount uses Math.round', () => {
  const order = { id: '10', status: 'pending', total_cents: 1000 };
  const result = applyDiscount(order, 33);
  assert.equal(result.total_cents, Math.round(1000 * 0.67));
});

test('applyDiscount at exactly 50 percent is allowed', () => {
  const order = { id: '11', status: 'pending', total_cents: 1000 };
  const result = applyDiscount(order, 50);
  assert.equal(result.total_cents, 500);
});

test('applyDiscount does not mutate the original order', () => {
  const order = { id: '12', status: 'pending', total_cents: 1000 };
  applyDiscount(order, 20);
  assert.equal(order.total_cents, 1000);
});

test('applyDiscount throws INVALID_DISCOUNT when percent is 0', () => {
  const order = { id: '13', status: 'pending', total_cents: 1000 };
  assert.throws(() => applyDiscount(order, 0), (err) => {
    assert.equal(err.code, 'INVALID_DISCOUNT');
    return true;
  });
});

test('applyDiscount throws INVALID_DISCOUNT when percent is negative', () => {
  const order = { id: '14', status: 'pending', total_cents: 1000 };
  assert.throws(() => applyDiscount(order, -5), (err) => {
    assert.equal(err.code, 'INVALID_DISCOUNT');
    return true;
  });
});

test('applyDiscount throws INVALID_DISCOUNT when percent exceeds 50', () => {
  const order = { id: '15', status: 'pending', total_cents: 1000 };
  assert.throws(() => applyDiscount(order, 51), (err) => {
    assert.equal(err.code, 'INVALID_DISCOUNT');
    return true;
  });
});
