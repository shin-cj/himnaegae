import assert from 'node:assert/strict';
import test from 'node:test';

import { formatOrderNumber } from '../../mobile/src/lib/order-number.ts';

test('일별 주문번호는 고객용 짧은 번호로 표시한다', () => {
  assert.equal(formatOrderNumber('A-20260829-17'), 'A-17');
  assert.equal(formatOrderNumber('A-20260829-0007'), 'A-0007');
});

test('예전 주문번호와 잘못된 형식은 원문을 유지한다', () => {
  assert.equal(formatOrderNumber('HNG-20260829-ABC123'), 'HNG-20260829-ABC123');
  assert.equal(formatOrderNumber('A-2026829-17'), 'A-2026829-17');
});
