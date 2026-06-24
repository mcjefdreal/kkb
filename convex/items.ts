import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import { creatorMutation } from './authz.js';

export const addItem = mutation({
	args: {
		roomId: v.id('rooms'),
		name: v.string(),
		priceCentavos: v.number(),
		qty: v.number()
	},
	handler: creatorMutation(async (ctx, { roomId, name, priceCentavos, qty }) => {
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
