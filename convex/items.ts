import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import type { Id } from './_generated/dataModel.js';
import { creatorMutation } from './authz.js';

export const addItem = mutation({
	args: {
		roomId: v.id('rooms'),
		name: v.string(),
		priceCentavos: v.number(),
		qty: v.number()
	},
	handler: creatorMutation<
		{ roomId: Id<'rooms'>; name: string; priceCentavos: number; qty: number },
		void
	>(async (ctx, { roomId, name, priceCentavos, qty }) => {
		const room = await ctx.db.get(roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for adding items');
		}
		if (!name.trim()) {
			throw new Error('Item name is required');
		}
		if (priceCentavos <= 0) {
			throw new Error('Price must be greater than 0');
		}
		if (qty <= 0) {
			throw new Error('Quantity must be greater than 0');
		}
		const items = await ctx.db
			.query('items')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();
		const currentTotal = items.reduce((sum, item) => sum + item.priceCentavos * item.qty, 0);
		const newTotal = currentTotal + priceCentavos * qty;
		if (newTotal > 100_000_000) {
			throw new Error('Bill total exceeds ₱1,000,000 limit');
		}
		await ctx.db.insert('items', {
			roomId,
			name: name.trim(),
			priceCentavos,
			qty,
			createdAt: Date.now()
		});
		await ctx.db.patch(roomId, { lastActivity: Date.now() });
	})
});

export const editItem = mutation({
	args: {
		roomId: v.id('rooms'),
		itemId: v.id('items'),
		name: v.string(),
		priceCentavos: v.number(),
		qty: v.number()
	},
	handler: creatorMutation<
		{
			roomId: Id<'rooms'>;
			itemId: Id<'items'>;
			name: string;
			priceCentavos: number;
			qty: number;
		},
		void
	>(async (ctx, { roomId, itemId, name, priceCentavos, qty }) => {
		const room = await ctx.db.get(roomId);
		if (!room || room.status !== 'collecting') {
			throw new Error('Room is not open for editing items');
		}
		const item = await ctx.db.get(itemId);
		if (!item || item.roomId !== roomId) {
			throw new Error('Item not found in this room');
		}
		if (!name.trim()) {
			throw new Error('Item name is required');
		}
		if (priceCentavos <= 0) {
			throw new Error('Price must be greater than 0');
		}
		if (qty <= 0) {
			throw new Error('Quantity must be greater than 0');
		}
		if (qty !== item.qty) {
			const claims = await ctx.db
				.query('itemClaims')
				.withIndex('itemId', (q) => q.eq('itemId', itemId))
				.collect();
			const totalShares = claims.reduce((sum, c) => sum + c.shares, 0);
			if (totalShares > qty) {
				throw new Error('Quantity cannot be less than total claimed shares');
			}
		}
		const items = await ctx.db
			.query('items')
			.withIndex('roomId', (q) => q.eq('roomId', roomId))
			.collect();
		const currentTotal = items.reduce((sum, i) => sum + i.priceCentavos * i.qty, 0);
		const adjustedTotal = currentTotal - item.priceCentavos * item.qty + priceCentavos * qty;
		if (adjustedTotal > 100_000_000) {
			throw new Error('Bill total exceeds ₱1,000,000 limit');
		}
		await ctx.db.patch(itemId, {
			name: name.trim(),
			priceCentavos,
			qty
		});
		await ctx.db.patch(roomId, { lastActivity: Date.now() });
	})
});
