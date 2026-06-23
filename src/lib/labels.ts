import type { PaymentMethod, PaymentStatus, RoomStatus } from './types.js';

export const roomStatusLabel: Record<RoomStatus, string> = {
	collecting: 'Collecting',
	settling: 'Settling',
	settled: 'All payments settled'
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
	pending: 'Pending',
	pending_confirmation: 'Awaiting confirmation',
	paid: 'Paid'
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
	// `pending` is never rendered; kept for type exhaustiveness.
	pending: '—',
	cash: 'Cash',
	gcash: 'GCash',
	maya: 'Maya'
};
