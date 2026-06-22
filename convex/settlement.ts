export interface SettlementItem {
	_id: string;
	name: string;
	priceCentavos: number;
	qty: number;
}

export interface SettlementClaim {
	itemId: string;
	userId: string;
	shares: number;
}

export interface SettlementContribution {
	userId: string;
	amountCentavos: number;
}

export interface SettlementState {
	items: SettlementItem[];
	claims: SettlementClaim[];
	contributions: SettlementContribution[];
}

export interface SettlementTransaction {
	payerUserId: string;
	payeeUserId: string;
	amountCentavos: number;
}

export interface SettlementResult {
	transactions: SettlementTransaction[];
	residueCentavos: number;
	unclaimedItems: SettlementItem[];
	fundingGap: number;
}

export function computeSettlement(
	state: SettlementState,
	mode: 'strict' | 'lenient'
): SettlementResult {
	const owed: Record<string, number> = {};
	const contributed: Record<string, number> = {};
	const unclaimedItems: SettlementItem[] = [];
	let totalCost = 0;
	let totalContributed = 0;

	for (const item of state.items) {
		const itemCost = item.priceCentavos * item.qty;
		totalCost += itemCost;
		const itemClaims = state.claims.filter((c) => c.itemId === item._id);
		const totalShares = itemClaims.reduce((sum, c) => sum + c.shares, 0);

		if (totalShares === 0) {
			unclaimedItems.push(item);
			continue;
		}

		const allocations: { userId: string; base: number; fraction: number }[] = [];
		let allocated = 0;
		for (const claim of itemClaims) {
			const base = Math.floor((itemCost * claim.shares) / totalShares);
			const fraction = (itemCost * claim.shares) / totalShares - base;
			allocations.push({ userId: claim.userId, base, fraction });
			allocated += base;
		}
		const remainder = itemCost - allocated;
		allocations
			.sort((a, b) => b.fraction - a.fraction)
			.slice(0, remainder)
			.forEach((a) => (a.base += 1));
		for (const a of allocations) {
			owed[a.userId] = (owed[a.userId] ?? 0) + a.base;
		}
	}

	for (const c of state.contributions) {
		contributed[c.userId] = (contributed[c.userId] ?? 0) + c.amountCentavos;
		totalContributed += c.amountCentavos;
	}

	const fundingGap = totalCost - totalContributed;

	if (mode === 'strict') {
		if (unclaimedItems.length > 0) {
			throw new Error('All items must be fully claimed before settlement');
		}
		if (fundingGap !== 0) {
			throw new Error('Total contributions must equal the bill total');
		}
	}

	const allUsers = new Set([...Object.keys(owed), ...Object.keys(contributed)]);
	const net: Record<string, number> = {};
	for (const userId of allUsers) {
		net[userId] = (contributed[userId] ?? 0) - (owed[userId] ?? 0);
	}

	const debtors = Object.entries(net)
		.filter(([, n]) => n < 0)
		.sort(([, a], [, b]) => a - b)
		.map(([userId, n]) => ({ userId, amount: -n }));
	const creditors = Object.entries(net)
		.filter(([, n]) => n > 0)
		.sort(([, a], [, b]) => b - a)
		.map(([userId, n]) => ({ userId, amount: n }));

	const transactions: SettlementTransaction[] = [];
	let i = 0;
	let j = 0;
	while (i < debtors.length && j < creditors.length) {
		const debtor = debtors[i];
		const creditor = creditors[j];
		if (debtor.userId === creditor.userId) {
			i++;
			continue;
		}
		const amount = Math.min(debtor.amount, creditor.amount);
		transactions.push({ payerUserId: debtor.userId, payeeUserId: creditor.userId, amountCentavos: amount });
		debtor.amount -= amount;
		creditor.amount -= amount;
		if (debtor.amount === 0) i++;
		if (creditor.amount === 0) j++;
	}

	const residueCentavos = creditors.reduce((sum, c) => sum + c.amount, 0);

	return {
		transactions,
		residueCentavos,
		unclaimedItems,
		fundingGap
	};
}

export function applyResidueToLargestCreditor(
	transactions: SettlementTransaction[],
	residueCentavos: number
): SettlementTransaction[] {
	if (residueCentavos <= 0) return transactions;

	const payeeTotals = new Map<string, number>();
	for (const t of transactions) {
		payeeTotals.set(t.payeeUserId, (payeeTotals.get(t.payeeUserId) ?? 0) + t.amountCentavos);
	}

	let targetPayee: string | null = null;
	let maxTotal = -1;
	for (const [payee, total] of payeeTotals) {
		if (total > maxTotal) {
			maxTotal = total;
			targetPayee = payee;
		}
	}
	if (!targetPayee) return transactions;

	let remaining = residueCentavos;
	const sorted = [...transactions].sort((a, b) => b.amountCentavos - a.amountCentavos);
	const result: SettlementTransaction[] = [];
	for (const t of sorted) {
		if (remaining > 0 && t.payeeUserId === targetPayee) {
			const reduceBy = Math.min(remaining, t.amountCentavos);
			const newAmount = t.amountCentavos - reduceBy;
			remaining -= reduceBy;
			if (newAmount > 0) {
				result.push({ ...t, amountCentavos: newAmount });
			}
		} else {
			result.push(t);
		}
	}
	return result;
}
