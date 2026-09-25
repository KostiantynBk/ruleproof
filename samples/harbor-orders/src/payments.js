async function charge(paymentRef, amountCents) {
  // call provider to charge paymentRef for amountCents
}

async function refund(paymentRef, amountCents) {
  // call provider to refund paymentRef for amountCents
}

module.exports = { charge, refund };
