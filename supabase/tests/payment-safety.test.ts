import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideCancellationAttempt,
  decidePaymentConfirmation,
  hasActiveProcessingLease,
  PROCESSING_LEASE_MS,
} from '../functions/_shared/payment-safety.ts';

const now = Date.parse('2026-08-29T12:00:00.000Z');
const baseOrder = {
  status: 'payment_pending',
  payment_status: 'pending',
  total_amount: 5_000,
  updated_at: new Date(now).toISOString(),
};

test('서버 주문 금액과 다른 승인 요청을 거부한다', () => {
  assert.equal(decidePaymentConfirmation(baseOrder, 4_500, now), 'amount_mismatch');
});

test('이미 결제된 주문은 기존 성공 결과로 종료한다', () => {
  assert.equal(decidePaymentConfirmation({ ...baseOrder, payment_status: 'paid' }, 5_000, now), 'already_paid');
});

test('취소된 주문의 결제 승인을 거부한다', () => {
  assert.equal(decidePaymentConfirmation({ ...baseOrder, status: 'cancelled', payment_status: 'refunded' }, 5_000, now), 'cancelled');
});

test('결제 대기 상태가 아닌 주문의 승인을 거부한다', () => {
  assert.equal(decidePaymentConfirmation({ ...baseOrder, status: 'preparing' }, 5_000, now), 'invalid_state');
});

test('최근 선점된 결제 확인의 중복 실행을 차단한다', () => {
  const order = { ...baseOrder, payment_status: 'confirming', updated_at: new Date(now - 10_000).toISOString() };
  assert.equal(decidePaymentConfirmation(order, 5_000, now), 'in_progress');
});

test('중단된 결제 확인은 잠금 만료 후 복구할 수 있다', () => {
  const order = { ...baseOrder, payment_status: 'confirming', updated_at: new Date(now - PROCESSING_LEASE_MS).toISOString() };
  assert.equal(decidePaymentConfirmation(order, 5_000, now), 'recover');
});

test('처리 잠금의 경계 시간을 정확히 판단한다', () => {
  assert.equal(hasActiveProcessingLease(new Date(now - PROCESSING_LEASE_MS + 1).toISOString(), now), true);
  assert.equal(hasActiveProcessingLease(new Date(now - PROCESSING_LEASE_MS).toISOString(), now), false);
  assert.equal(hasActiveProcessingLease('invalid-date', now), false);
});

test('다른 사용자의 주문 취소를 거부한다', () => {
  const order = { user_id: 'owner', status: 'paid', payment_status: 'paid', updated_at: new Date(now).toISOString() };
  assert.equal(decideCancellationAttempt(order, 'attacker', false, now), 'forbidden');
});

test('고객은 제조가 시작된 주문을 취소할 수 없다', () => {
  const order = { user_id: 'owner', status: 'preparing', payment_status: 'paid', updated_at: new Date(now).toISOString() };
  assert.equal(decideCancellationAttempt(order, 'owner', false, now), 'not_allowed');
  assert.equal(decideCancellationAttempt(order, 'admin', true, now), 'claim');
});

test('최근 취소 요청의 중복 실행을 차단하고 중단된 요청은 복구한다', () => {
  const recent = { user_id: 'owner', status: 'cancel_requested', payment_status: 'paid', updated_at: new Date(now - 10_000).toISOString() };
  const stale = { ...recent, updated_at: new Date(now - PROCESSING_LEASE_MS).toISOString() };
  assert.equal(decideCancellationAttempt(recent, 'owner', false, now), 'cancel_in_progress');
  assert.equal(decideCancellationAttempt(stale, 'owner', false, now), 'claim');
});

test('이미 취소된 주문은 멱등하게 성공 처리한다', () => {
  const order = { user_id: 'owner', status: 'cancelled', payment_status: 'refunded', updated_at: new Date(now).toISOString() };
  assert.equal(decideCancellationAttempt(order, 'owner', false, now), 'already_cancelled');
});

test('결제 확인 중에는 취소를 시작하지 않는다', () => {
  const order = { user_id: 'owner', status: 'payment_pending', payment_status: 'confirming', updated_at: new Date(now).toISOString() };
  assert.equal(decideCancellationAttempt(order, 'owner', false, now), 'payment_in_progress');
});
