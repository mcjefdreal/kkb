import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	profiles: defineTable({
		userId: v.string(),
		displayName: v.string(),
		gcashNumber: v.optional(v.string()),
		mayaNumber: v.optional(v.string()),
		createdAt: v.number()
	})
		.index('userId', ['userId'])
		.searchIndex('displayName', { searchField: 'displayName' }),

	rooms: defineTable({
		code: v.string(),
		name: v.string(),
		createdBy: v.string(),
		status: v.union(
			v.literal('collecting'),
			v.literal('settling'),
			v.literal('settled')
		),
		lastActivity: v.number(),
		createdAt: v.number()
	})
		.index('code', ['code'])
		.index('createdBy', ['createdBy'])
		.index('status_lastActivity', ['status', 'lastActivity']),

	roomMembers: defineTable({
		roomId: v.id('rooms'),
		userId: v.string(),
		role: v.union(v.literal('member'), v.literal('contributor')),
		joinedAt: v.number()
	})
		.index('roomId_userId', ['roomId', 'userId'])
		.index('roomId', ['roomId'])
		.index('userId', ['userId']),

	items: defineTable({
		roomId: v.id('rooms'),
		name: v.string(),
		priceCentavos: v.number(),
		qty: v.number(),
		createdAt: v.number()
	})
		.index('roomId', ['roomId']),

	itemClaims: defineTable({
		roomId: v.id('rooms'),
		itemId: v.id('items'),
		userId: v.string(),
		shares: v.number()
	})
		.index('roomId', ['roomId'])
		.index('roomId_userId', ['roomId', 'userId'])
		.index('itemId_userId', ['itemId', 'userId'])
		.index('itemId', ['itemId'])
		.index('userId', ['userId']),

	contributions: defineTable({
		roomId: v.id('rooms'),
		userId: v.string(),
		amountCentavos: v.number()
	})
		.index('roomId_userId', ['roomId', 'userId'])
		.index('roomId', ['roomId']),

	settlementPayments: defineTable({
		roomId: v.id('rooms'),
		payerUserId: v.string(),
		payeeUserId: v.string(),
		amountCentavos: v.number(),
		method: v.union(v.literal('pending'), v.literal('cash'), v.literal('gcash'), v.literal('maya')),
		status: v.union(
			v.literal('pending'),
			v.literal('pending_confirmation'),
			v.literal('confirmed')
		),
		reference: v.optional(v.string()),
		createdAt: v.number()
	})
		.index('roomId', ['roomId'])
		.index('roomId_status', ['roomId', 'status'])
		.index('payerUserId', ['payerUserId'])
		.index('payeeUserId', ['payeeUserId'])
});
