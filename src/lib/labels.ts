import type { PaymentStatus, RoomStatus } from './types.js';

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
