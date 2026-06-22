import { action, mutation, type QueryCtx, type MutationCtx } from './_generated/server.js';
import { api } from './_generated/api.js';
import { creatorMutation, requireContributor, requireMember, getUserId } from './authz.js';
import { computeSettlement } from './settlement.js';
import { authComponent } from './betterAuth/auth.js';
import { v } from 'convex/values';
import type { Id } from 'convex/values';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const MAX_RETRIES = 5;

function generateCode(): string {
	let code = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
	}
	return code;
}

async function ensureProfile(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error('Unauthorized');
	}
	const existing = await ctx.db
		.query('profiles')
		.withIndex('userId', (q) => q.eq('userId', identity.subject))
		.unique();
	if (existing) {
		return identity.subject;
	}
	const user = await authComponent.getAuthUser(ctx);
	const displayName = user?.name || user?.email || 'User';
	await ctx.db.insert('profiles', {
		userId: identity.subject,
		displayName,
		createdAt: Date.now()
	});
	return identity.subject;
}

async function getRoomTotal(ctx: QueryCtx | MutationCtx, roomId: Id<'rooms'>): Promise<number> {
	const items = await ctx.db.query('items').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
	return items.reduce((sum, item) => sum + item.priceCentavos * item.qty, 0);
}

export const insertRoom = mutation({
	args: {
		code: v.string(),
		name: v.string(),
		items: v.array(
			v.object({
				name: v.string(),
				priceCentavos: v.number(),
				qty: v.number()
			})
		),
		ownContributionCentavos: v.number()
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('rooms')
			.withIndex('code', (q) => q.eq('code', args.code))
			.unique();
		if (existing) {
			throw new Error('CODE_CONFLICT');
		}
		const userId = await ensureProfile(ctx);
		const total = args.items.reduce((sum, item) => sum + item.priceCentavos * item.qty, 0);
		if (total > 100_000_000) {
			throw new Error('Bill total exceeds ₱1,000,000 limit');
		}
		if (args.ownContributionCentavos < 0 || args.ownContributionCentavos > total) {
			throw new Error('Invalid contribution amount');
		}
		const now = Date.now();
		const roomId = await ctx.db.insert('rooms', {
			code: args.code,
			name: args.name,
			createdBy: userId,
			status: 'collecting',
			lastActivity: now,
			createdAt: now
		});
		await Promise.all(
			args.items.map((item) =>
				ctx.db.insert('items', {
					roomId,
					name: item.name,
					priceCentavos: item.priceCentavos,
					qty: item.qty,
					createdAt: now
				})
			)
		);
		await ctx.db.insert('roomMembers', {
			roomId,
			userId,
			role: 'contributor',
			joinedAt: now
		});
		if (args.ownContributionCentavos > 0) {
			await ctx.db.insert('contributions', {
				roomId,
				userId,
				amountCentavos: args.ownContributionCentavos
			});
		}
		return args.code;
	}
});

export const createRoom = action({
	args: {
		name: v.string(),
		items: v.array(
			v.object({
				name: v.string(),
				priceCentavos: v.number(),
				qty: v.number()
			})
		),
		ownContributionCentavos: v.number()
	},
	handler: async (ctx, args) => {
		let lastError: unknown;
		for (let i = 0; i < MAX_RETRIES; i++) {
			const code = generateCode();
			try {
				return await ctx.runMutation(api.rooms.insertRoom, {
					code,
					name: args.name,
					items: args.items,
					ownContributionCentavos: args.ownContributionCentavos
				});
			} catch (err) {
				lastError = err;
				const message = err instanceof Error ? err.message : String(err);
				if (!message.includes('CODE_CONFLICT')) {
					throw err;
				}
			}
		}
		throw new Error(`Failed to generate unique room code after ${MAX_RETRIES} attempts: ${lastError}`);
	}
});

export const joinRoom = mutation({
	args: { code: v.string() },
	handler: async (ctx, { code }) => {
		const userId = await ensureProfile(ctx);
		const room = await ctx.db.query('rooms').withIndex('code', (q) => q.eq('code', code)).unique();
		if (!room) {
			throw new Error('Room not found');
		}
		const existing = await ctx.db
			.query('roomMembers')
			.withIndex('roomId_userId', (q) => q.eq('roomId', room._id).eq('userId', userId))
			.unique();
		if (!existing) {
			await ctx.db.insert('roomMembers', {
				roomId: room._id,
				userId,
				role: 'member',
				joinedAt: Date.now()
			});
		}
		return room._id;
	}
});

export const leaveRoom = mutation({
	args: { roomId: v.id('rooms') },
	handler: async (ctx, { roomId }) => {
		const { userId, member } = await requireMember(ctx, roomId);
		await ctx.db.delete(member._id);
		const contribution = await ctx.db
			.query('contributions')
			.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
			.unique();
		if (contribution) {
			await ctx.db.delete(contribution._id);
		}
		const claims = await ctx.db
			.query('itemClaims')
			.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
			.collect();
		for (const claim of claims) {
			await ctx.db.delete(claim._id);
		}
	}
});

export const setMemberRole = mutation({
	args: {
		roomId: v.id('rooms'),
		targetUserId: v.string(),
		role: v.union(v.literal('member'), v.literal('contributor'))
	},
	handler: creatorMutation(async (ctx, { roomId, targetUserId, role }) => {
		const member = await ctx.db
			.query('roomMembers')
			.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', targetUserId))
			.unique();
		if (!member) {
			throw new Error('Member not found');
		}
		if (member.role === role) {
			return;
		}
		await ctx.db.patch(member._id, { role });
		if (role === 'member') {
			const contribution = await ctx.db
				.query('contributions')
				.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', targetUserId))
				.unique();
			if (contribution) {
				await ctx.db.delete(contribution._id);
			}
		}
	})
});

export const setContribution = mutation({
	args: {
		roomId: v.id('rooms'),
		amountCentavos: v.number()
	},
		handler: async (ctx, { roomId, amountCentavos }) => {
		const { userId } = await requireContributor(ctx, roomId);
		const room = await ctx.db.get(roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for contributions');
		}
		const total = await getRoomTotal(ctx, roomId);
		if (total === 0) {
			throw new Error('Cannot contribute to a room with no bill total');
		}
		if (amountCentavos < 0 || amountCentavos > total) {
			throw new Error('Contribution must be between 0 and the bill total');
		}
		const otherTotal = (
			await ctx.db
				.query('contributions')
				.withIndex('roomId', (q) => q.eq('roomId', roomId))
				.collect()
		).reduce((sum, c) => (c.userId !== userId ? sum + c.amountCentavos : sum), 0);
		if (amountCentavos > total - otherTotal) {
			throw new Error('Contribution would exceed remaining bill total');
		}
		const existing = await ctx.db
			.query('contributions')
			.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
			.unique();
		if (amountCentavos === 0) {
			if (existing) {
				await ctx.db.delete(existing._id);
			}
			return;
		}
		if (existing) {
			await ctx.db.patch(existing._id, { amountCentavos });
		} else {
			await ctx.db.insert('contributions', { roomId, userId, amountCentavos });
		}
		await ctx.db.patch(roomId, { lastActivity: Date.now() });
	}
});

export const finalizeSettlement = mutation({
	args: { roomId: v.id('rooms') },
	handler: creatorMutation(async (ctx, { roomId }) => {
		const room = await ctx.db.get(roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for settlement');
		}
		const items = await ctx.db.query('items').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const allClaims = await ctx.db
			.query('itemClaims')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();
		const contributions = await ctx.db.query('contributions').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();

		let totalCost = 0;
		for (const item of items) {
			totalCost += item.priceCentavos * item.qty;
			const itemClaims = allClaims.filter((c) => c.itemId === item._id);
			const totalShares = itemClaims.reduce((sum, c) => sum + c.shares, 0);
			if (totalShares !== item.qty) {
				throw new Error(`Item "${item.name}" is not fully claimed`);
			}
		}

		const totalContributed = contributions.reduce((sum, c) => sum + c.amountCentavos, 0);
		if (totalContributed !== totalCost) {
			throw new Error('Total contributions must equal the bill total');
		}

		const { transactions, residueCentavos } = computeSettlement(
			{
				items: items.map((i) => ({
					_id: i._id,
					name: i.name,
					priceCentavos: i.priceCentavos,
					qty: i.qty
				})),
			claims: allClaims.map((c) => ({ itemId: c.itemId, userId: c.userId, shares: c.shares })),
				contributions: contributions.map((c) => ({
					userId: c.userId,
					amountCentavos: c.amountCentavos
				}))
			},
			'strict'
		);

		const now = Date.now();
		for (const t of transactions) {
			await ctx.db.insert('settlementPayments', {
				roomId,
				payerUserId: t.payerUserId,
				payeeUserId: t.payeeUserId,
				amountCentavos: t.amountCentavos,
				method: 'pending',
				status: 'pending',
				createdAt: now
			});
		}

		await ctx.db.patch(roomId, { status: 'settling', lastActivity: now });

		return { transactions, residueCentavos };
	})
});

export const markPaid = mutation({
	args: {
		settlementId: v.id('settlementPayments'),
		method: v.union(v.literal('cash'), v.literal('gcash'), v.literal('maya')),
		reference: v.optional(v.string())
	},
	handler: async (ctx, { settlementId, method, reference }) => {
		const payment = await ctx.db.get(settlementId);
		if (!payment) {
			throw new Error('Payment not found');
		}
		const userId = await getUserId(ctx);
		if (payment.payerUserId !== userId) {
			throw new Error('Only the payer can mark this paid');
		}
		if (payment.status !== 'pending') {
			throw new Error('Payment can only be marked from pending status');
		}
		if (payment.method !== 'pending' && payment.method !== method) {
			throw new Error('Payment method cannot be changed');
		}
		if (method === 'gcash' || method === 'maya') {
			const profile = await ctx.db
				.query('profiles')
				.withIndex('userId', (q) => q.eq('userId', payment.payeeUserId))
				.unique();
			const number = method === 'gcash' ? profile?.gcashNumber : profile?.mayaNumber;
			if (!number) {
				throw new Error(`Payee has not configured ${method} number`);
			}
		}
		const status = method === 'cash' ? 'confirmed' : 'pending_confirmation';
		await ctx.db.patch(settlementId, { method, status, reference });
	}
});

export const unmarkPaid = mutation({
	args: { settlementId: v.id('settlementPayments') },
	handler: async (ctx, { settlementId }) => {
		const payment = await ctx.db.get(settlementId);
		if (!payment) {
			throw new Error('Payment not found');
		}
		const userId = await getUserId(ctx);
		if (payment.payerUserId !== userId) {
			throw new Error('Only the payer can unmark this payment');
		}
		if (payment.status !== 'pending_confirmation') {
			throw new Error('Only pending-confirmation payments can be unmarked');
		}
		await ctx.db.patch(settlementId, { method: 'pending', status: 'pending', reference: undefined });
	}
});

export const confirmPayment = mutation({
	args: { settlementId: v.id('settlementPayments') },
	handler: async (ctx, { settlementId }) => {
		const payment = await ctx.db.get(settlementId);
		if (!payment) {
			throw new Error('Payment not found');
		}
		const userId = await getUserId(ctx);
		if (payment.payeeUserId !== userId) {
			throw new Error('Only the payee can confirm this payment');
		}
		if (payment.status !== 'pending_confirmation') {
			throw new Error('Payment must be pending confirmation');
		}
		await ctx.db.patch(settlementId, { status: 'confirmed' });
		const allPayments = await ctx.db
			.query('settlementPayments')
			.withIndex('roomId', (q) => q.eq('roomId', payment.roomId))
			.collect();
		if (allPayments.every((p) => p.status === 'confirmed')) {
			await ctx.db.patch(payment.roomId, { status: 'settled', lastActivity: Date.now() });
		}
	}
});

export const reopenRoom = mutation({
	args: { roomId: v.id('rooms') },
	handler: creatorMutation(async (ctx, { roomId }) => {
		const payments = await ctx.db
			.query('settlementPayments')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();
		if (payments.some((p) => p.status === 'confirmed')) {
			throw new Error('Cannot reopen: some payments are already confirmed');
		}
		for (const payment of payments) {
			await ctx.db.delete(payment._id);
		}
		await ctx.db.patch(roomId, { status: 'collecting', lastActivity: Date.now() });
	})
});

export const deleteRoom = mutation({
	args: { roomId: v.id('rooms') },
	handler: creatorMutation(async (ctx, { roomId }) => {
		const members = await ctx.db.query('roomMembers').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const items = await ctx.db.query('items').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const contributions = await ctx.db.query('contributions').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const payments = await ctx.db.query('settlementPayments').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const claims = await ctx.db
			.query('itemClaims')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();

		for (const p of payments) await ctx.db.delete(p._id);
		for (const c of contributions) await ctx.db.delete(c._id);
		for (const claim of claims) {
			await ctx.db.delete(claim._id);
		}
		for (const item of items) await ctx.db.delete(item._id);
		for (const m of members) await ctx.db.delete(m._id);
		await ctx.db.delete(roomId);
	})
});
