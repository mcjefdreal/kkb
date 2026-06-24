import { mutation } from './_generated/server.js';
import { getUserId } from './authz.js';
import { v } from 'convex/values';

export const updateProfile = mutation({
	args: {
		displayName: v.string()
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		const existing = await ctx.db
			.query('profiles')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.unique();
		const trimmedName = args.displayName.trim();
		if (!trimmedName) {
			throw new Error('Display name is required');
		}
		if (existing) {
			await ctx.db.patch(existing._id, {
				displayName: trimmedName
			});
		} else {
			await ctx.db.insert('profiles', {
				userId,
				displayName: trimmedName,
				createdAt: Date.now()
			});
		}
	}
});
