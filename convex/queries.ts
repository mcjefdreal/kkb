import { query } from './_generated/server.js';
import { roomQuery, getUserId } from './authz.js';
import { computeSettlement } from './settlement.js';
import { v } from 'convex/values';

export const whoami = query({
	args: {},
	handler: async (ctx) => ctx.auth.getUserIdentity()
});

export const getRoomByCode = query({
	args: { code: v.string() },
	handler: async (ctx, { code }) => {
		const room = await ctx.db.query('rooms').withIndex('code', (q) => q.eq('code', code)).unique();
		if (!room) {
			return null;
		}
		const identity = await ctx.auth.getUserIdentity();
		let alreadyMember = false;
		if (identity) {
			const membership = await ctx.db
				.query('roomMembers')
				.withIndex('roomId_userId', (q) => q.eq('roomId', room._id).eq('userId', identity.subject))
				.unique();
			alreadyMember = !!membership;
		}
		return { roomId: room._id, alreadyMember };
	}
});

export const getRoomState = query({
	args: { roomId: v.id('rooms') },
	handler: roomQuery(async (ctx, { roomId }) => {
		const room = await ctx.db.get(roomId);
		if (!room) {
			throw new Error('Room not found');
		}
		const members = await ctx.db.query('roomMembers').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const items = await ctx.db.query('items').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const claims = await ctx.db.query('itemClaims').collect();
		const contributions = await ctx.db.query('contributions').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const settlements = await ctx.db
			.query('settlementPayments')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();
		const userIds = new Set(members.map((m) => m.userId));
		const profiles: Record<string, { displayName: string; gcashNumber?: string; mayaNumber?: string }> = {};
		for (const userId of userIds) {
			const profile = await ctx.db.query('profiles').withIndex('userId', (q) => q.eq('userId', userId)).unique();
			if (profile) {
				profiles[userId] = {
					displayName: profile.displayName,
					gcashNumber: profile.gcashNumber,
					mayaNumber: profile.mayaNumber
				};
			}
		}
		return { room, members, items, claims, contributions, settlements, profiles };
	})
});

export const previewSettlement = query({
	args: { roomId: v.id('rooms') },
	handler: roomQuery(async (ctx, { roomId }) => {
		const room = await ctx.db.get(roomId);
		if (!room) {
			throw new Error('Room not found');
		}
		const items = await ctx.db.query('items').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const claims = await ctx.db.query('itemClaims').collect();
		const contributions = await ctx.db.query('contributions').withIndex('roomId', (q) => q.eq('roomId', roomId)).collect();
		const result = computeSettlement(
			{
				items: items.map((i) => ({ _id: i._id, name: i.name, priceCentavos: i.priceCentavos, qty: i.qty })),
				claims: claims
					.filter((c) => items.some((i) => i._id === c.itemId))
					.map((c) => ({ itemId: c.itemId, userId: c.userId, shares: c.shares })),
				contributions: contributions.map((c) => ({
					userId: c.userId,
					amountCentavos: c.amountCentavos
				}))
			},
			'lenient'
		);
		return {
			transactions: result.transactions,
			residueCentavos: result.residueCentavos,
			unclaimedItems: result.unclaimedItems,
			fundingGap: result.fundingGap
		};
	})
});

export const listMyRooms = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const memberships = await ctx.db.query('roomMembers').withIndex('userId', (q) => q.eq('userId', userId)).collect();
		const rooms = await Promise.all(
			memberships.map(async (m) => {
				const room = await ctx.db.get(m.roomId);
				return room ? { ...room, role: m.role } : null;
			})
		);
		return rooms.filter((r): r is NonNullable<typeof r> => r !== null);
	}
});

export const getMyProfile = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		return ctx.db.query('profiles').withIndex('userId', (q) => q.eq('userId', userId)).unique();
	}
});
