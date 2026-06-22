import { mutation } from './_generated/server.js';
import { requireMember, getUserId } from './authz.js';
import { v } from 'convex/values';

export const setClaim = mutation({
	args: {
		itemId: v.id('items'),
		shares: v.number()
	},
	handler: async (ctx, { itemId, shares }) => {
		if (shares < 0) {
			throw new Error('Shares cannot be negative');
		}
		const item = await ctx.db.get(itemId);
		if (!item) {
			throw new Error('Item not found');
		}
		const userId = await getUserId(ctx);
		await requireMember(ctx, item.roomId);
		const room = await ctx.db.get(item.roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for claims');
		}
		const existing = await ctx.db
			.query('itemClaims')
			.withIndex('itemId_userId', (q) => q.eq('itemId', itemId).eq('userId', userId))
			.unique();
		const otherShares = (
			await ctx.db.query('itemClaims').withIndex('itemId', (q) => q.eq('itemId', itemId)).collect()
		).reduce((sum, claim) => (claim.userId !== userId ? sum + claim.shares : sum), 0);
		const ownShares = existing ? existing.shares : 0;
		if (otherShares + shares > item.qty) {
			throw new Error('Total shares exceed item quantity');
		}
		if (shares === 0) {
			if (existing) {
				await ctx.db.delete(existing._id);
			}
		} else if (existing) {
			await ctx.db.patch(existing._id, { shares });
		} else {
			await ctx.db.insert('itemClaims', { roomId: item.roomId, itemId, userId, shares });
		}
		await ctx.db.patch(item.roomId, { lastActivity: Date.now() });
	}
});

export const deleteClaim = mutation({
	args: { itemId: v.id('items') },
	handler: async (ctx, { itemId }) => {
		const item = await ctx.db.get(itemId);
		if (!item) {
			throw new Error('Item not found');
		}
		const userId = await getUserId(ctx);
		await requireMember(ctx, item.roomId);
		const room = await ctx.db.get(item.roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for claims');
		}
		const existing = await ctx.db
			.query('itemClaims')
			.withIndex('itemId_userId', (q) => q.eq('itemId', itemId).eq('userId', userId))
			.unique();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		await ctx.db.patch(item.roomId, { lastActivity: Date.now() });
	}
});
