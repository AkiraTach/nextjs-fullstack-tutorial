import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals } from '../src/features/pricing/domain/totals';
import { canTransition } from '../src/features/orders/domain/status';
test('coupon and shipping', () => {
  assert.deepEqual(totals(2990, 'LEARN10'), {
    subtotal: 2990,
    discount: 299,
    shipping: 500,
    total: 3191
  });
  assert.equal(totals(5000, '').shipping, 0);
  assert.throws(() => totals(-1, ''));
});
test('order transitions', () => {
  assert.equal(canTransition('paid', 'shipped'), true);
  assert.equal(canTransition('paid', 'refunded'), false);
  assert.equal(canTransition('refunded', 'paid'), false);
  assert.equal(canTransition('return_requested', 'refunded'), true);
});
