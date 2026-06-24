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

export interface SettlementChange {
	userId: string;
	amountCentavos: number;
}

export interface SettlementResult {
	transactions: SettlementTransaction[];
	change: SettlementChange[];
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

		for (const claim of itemClaims) {
			if (claim.shares > 0) {
				owed[claim.userId] = (owed[claim.userId] ?? 0) + claim.shares * item.priceCentavos;
			}
		}

		if (totalShares < item.qty) {
			unclaimedItems.push({ ...item, qty: item.qty - totalShares });
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
		if (fundingGap > 0) {
			throw new Error('Total contributions must cover the bill total');
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

	const change: SettlementChange[] = creditors
		.filter((c) => c.amount > 0)
		.map((c) => ({ userId: c.userId, amountCentavos: c.amount }));

	return {
		transactions,
		change,
		unclaimedItems,
		fundingGap
	};
}


