// Central mapping for user-facing error messages.
// All mutation/action errors surfaced as toasts should go through friendlyError.
// When a new server-side error string is added, add it here.

function extractMessage(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	}
	if (typeof err === 'string') {
		return err;
	}
	if (
		err !== null &&
		typeof err === 'object' &&
		'message' in err &&
		typeof (err as Record<string, unknown>).message === 'string'
	) {
		return (err as { message: string }).message;
	}
	return '';
}

const ERROR_MESSAGES: Record<string, string> = {
	// Server: convex/authz.ts
	Unauthorized: 'Please sign in again',
	'Not a member of this room': 'You are not a member of this room',
	'Room not found': 'Room not found',
	'Only the room creator can do this': 'Only the room creator can do that',
	'Only contributors can do this': 'Only contributors can do that',

	// Server: convex/rooms.ts
	// 'CODE_CONFLICT' is intentionally omitted; createRoom swallows it internally and throws a composite message after retries.
	'Bill total exceeds ₱1,000,000 limit': 'Bill total exceeds ₱1,000,000',
	'Invalid contribution amount': 'Invalid contribution amount',
	'Room is not open for leaving': 'Room is not open for leaving',
	'Member not found': 'Member not found',
	'Contribution cannot be negative': 'Contribution cannot be negative',
	'Room is not open for contributions': 'Room is not open for contributions',
	'Cannot contribute to a room with no bill total': 'Add bill items before contributing',
	'Room is not open for settlement': 'Room is not open for settlement',
	'Total contributions must cover the bill total': 'Total contributions must cover the bill total',
	'Payment not found': 'Payment not found',
	'Only the payer can mark this paid': 'Only the payer can mark this paid',
	'Payment can only be marked from pending status': 'Payment can only be marked from pending',
	'Payment method cannot be changed': 'Payment method cannot be changed',
	'Only the payer can undo this payment': 'Only the payer can undo this payment',
	'Only pending-confirmation payments can be undone': 'Only pending-confirmation payments can be undone',
	'Only the payee can confirm this payment': 'Only the payee can confirm this payment',
	'Payment must be pending confirmation': 'Payment must be pending confirmation',
	'Cannot reopen: some payments are in progress': 'Cannot reopen: some payments are still in progress',

	// Server: convex/claims.ts
	// 'Item not found' and 'Room is not open for claims' are shared with deleteClaim.
	'Shares cannot be negative': 'Shares cannot be negative',
	'Item not found': 'Item not found',
	'Room is not open for claims': 'Room is not open for claims',
	'Total shares exceed item quantity': 'Total shares exceed item quantity',

	// Server: convex/items.ts
	'Room is not open for adding items': 'Room is not open for adding items',
	'Room is not open for editing items': 'Room is not open for editing items',
	'Item name is required': 'Item name is required',
	'Price must be greater than 0': 'Price must be greater than 0',
	'Quantity must be greater than 0': 'Quantity must be greater than 0',
	'Item not found in this room': 'Item not found',
	'Quantity cannot be less than total claimed shares': 'Quantity cannot be less than total claimed shares',

	// Server: convex/profiles.ts
	'Display name is required': 'Display name is required',

	// Client: src/lib/money.ts
	'Amount is required': 'Amount is required',
	'Invalid amount': 'Invalid amount',
	'Amount cannot be negative': 'Amount cannot be negative',
	'Amount exceeds maximum of ₱1,000,000': 'Amount cannot exceed ₱1,000,000'
};

export function friendlyError(err: unknown, fallback: string): string {
	const message = extractMessage(err);

	// Interpolated server messages.
	if (message.startsWith('Item "') && message.endsWith('" is not fully claimed')) {
		return 'An item hasn’t been fully claimed yet';
	}
	// Exact match.
	if (message in ERROR_MESSAGES) {
		return ERROR_MESSAGES[message];
	}

	// Framework-level generic messages.
	const lower = message.toLowerCase();
	if (lower.includes('unauthenticated') || lower.includes('autherror') || lower.includes('permission')) {
		return 'Please sign in again';
	}
	if (lower.includes('rate limit') || lower.includes('rate_limit')) {
		return 'Too many requests — please wait a moment';
	}
	if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
		return 'Network error. Check your connection.';
	}

	return fallback;
}
