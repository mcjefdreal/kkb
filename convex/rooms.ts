import { action, mutation, type QueryCtx, type MutationCtx } from './_generated/server.js';
import { api } from './_generated/api.js';
import { creatorMutation, requireContributor, requireMember, getUserId } from './authz.js';
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
		const claims = await ctx.db.query('itemClaims').withIndex('userId', (q) => q.eq('userId', userId)).collect();
		for (const claim of claims) {
			const item = await ctx.db.get(claim.itemId);
			if (item && item.roomId === roomId) {
				await ctx.db.delete(claim._id);
			}
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
		const total = await getRoomTotal(ctx, roomId);
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
