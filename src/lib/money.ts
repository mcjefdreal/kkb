const MAX_CENTAVOS = 100_000_000;

export function toCentavos(value: string): number {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error('Amount is required');
	}
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) {
		throw new Error('Invalid amount');
	}
	const centavos = Math.round(parsed * 100);
	if (centavos < 0) {
		throw new Error('Amount cannot be negative');
	}
	if (centavos > MAX_CENTAVOS) {
		throw new Error('Amount exceeds maximum of ₱1,000,000');
	}
	return centavos;
}

export function formatPHP(centavos: number): string {
	const amount = centavos / 100;
	return new Intl.NumberFormat('en-PH', {
		style: 'currency',
		currency: 'PHP',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}
