const { clock } = require('./clock');
const { AppError } = require('./errors');
const payments = require('./payments');
const audit = require('./audit');

function markPaid(order, paymentRef) {
  if (order.status !== 'pending') {
    throw new AppError('ORDER_NOT_PENDING', 'Order is not pending');
  }
  return { ...order, status: 'paid', paymentRef, paidAt: clock.now() };
}

function markShipped(order, trackingNumber) {
  if (order.status !== 'paid') {
    throw new AppError('ORDER_NOT_PAID', 'Order is not paid');
  }
  return { ...order, status: 'shipped', trackingNumber, shippedAt: clock.now() };
}

function applyDiscount(order, percent) {
  if (percent <= 0 || percent > 50) {
    throw new AppError('INVALID_DISCOUNT', 'Discount must be between 1 and 50 percent');
  }
  return { ...order, total_cents: Math.round(order.total_cents * (1 - percent / 100)) };
}

module.exports = { markPaid, markShipped, applyDiscount };
