export const PROCESSING_LEASE_MS = 60_000;

type ConfirmationOrder = {
  status: string;
  payment_status: string;
  total_amount: number;
  updated_at: string;
};

type CancellationOrder = {
  user_id: string;
  status: string;
  payment_status: string;
  updated_at: string;
};

export type ConfirmationDecision =
  | 'amount_mismatch'
  | 'already_paid'
  | 'cancelled'
  | 'invalid_state'
  | 'in_progress'
  | 'claim'
  | 'recover';

export type CancellationDecision =
  | 'already_cancelled'
  | 'forbidden'
  | 'payment_in_progress'
  | 'cancel_in_progress'
  | 'not_allowed'
  | 'claim';

const customerCancellableStatuses = ['payment_pending', 'paid', 'accepted'];

export function hasActiveProcessingLease(
  updatedAt: string,
  now = Date.now(),
  leaseMs = PROCESSING_LEASE_MS,
) {
  const updatedAtMs = Date.parse(updatedAt);
  return Number.isFinite(updatedAtMs) && now - updatedAtMs >= 0 && now - updatedAtMs < leaseMs;
}

export function decidePaymentConfirmation(
  order: ConfirmationOrder,
  amount: number,
  now = Date.now(),
): ConfirmationDecision {
  if (!Number.isInteger(amount) || order.total_amount !== amount) return 'amount_mismatch';
  if (order.payment_status === 'paid') return 'already_paid';
  if (order.status === 'cancelled' || ['cancelled', 'refunded'].includes(order.payment_status)) return 'cancelled';
  if (order.status !== 'payment_pending') return 'invalid_state';

  if (order.payment_status === 'confirming') {
    return hasActiveProcessingLease(order.updated_at, now) ? 'in_progress' : 'recover';
  }

  return ['pending', 'failed'].includes(order.payment_status) ? 'claim' : 'invalid_state';
}

export function decideCancellationAttempt(
  order: CancellationOrder,
  requesterId: string,
  isAdmin: boolean,
  now = Date.now(),
): CancellationDecision {
  const isOwner = order.user_id === requesterId;
  if (!isAdmin && !isOwner) return 'forbidden';
  if (order.status === 'cancelled' || ['cancelled', 'refunded'].includes(order.payment_status)) return 'already_cancelled';
  if (order.payment_status === 'confirming') return 'payment_in_progress';
  if (order.status === 'cancel_requested' && hasActiveProcessingLease(order.updated_at, now)) return 'cancel_in_progress';
  if (isAdmin || (isOwner && [...customerCancellableStatuses, 'cancel_requested'].includes(order.status))) return 'claim';
  return 'not_allowed';
}
