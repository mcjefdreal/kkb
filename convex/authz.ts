import type { QueryCtx, MutationCtx } from './_generated/server.js';
import type { Id } from 'convex/values';

export async function getUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error('Unauthorized');
	}
	return identity.subject;
}

export async function requireMember(ctx: QueryCtx | MutationCtx, roomId: Id<'rooms'>) {
	const userId = await getUserId(ctx);
	const member = await ctx.db
		.query('roomMembers')
		.withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
		.unique();
	if (!member) {
		throw new Error('Not a member of this room');
	}
	return { userId, member };
}

export async function requireCreator(ctx: QueryCtx | MutationCtx, roomId: Id<'rooms'>) {
	const { userId, member } = await requireMember(ctx, roomId);
	const room = await ctx.db.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}
	if (room.createdBy !== userId) {
		throw new Error('Only the room creator can do this');
	}
	return { userId, member, room };
}

export async function requireContributor(ctx: QueryCtx | MutationCtx, roomId: Id<'rooms'>) {
	const { userId, member } = await requireMember(ctx, roomId);
	const room = await ctx.db.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}
	if (room.createdBy !== userId && member.role !== 'contributor') {
		throw new Error('Only contributors can do this');
	}
	return { userId, member, room };
}

type RoomArgs = { roomId: Id<'rooms'> };

export function roomQuery<Args extends RoomArgs, Return>(
	handler: (ctx: QueryCtx, args: Args) => Promise<Return>
) {
	return async (ctx: QueryCtx, args: Args): Promise<Return> => {
		await requireMember(ctx, args.roomId);
		return handler(ctx, args);
	};
}

export function roomMutation<Args extends RoomArgs, Return>(
	handler: (ctx: MutationCtx, args: Args) => Promise<Return>
) {
	return async (ctx: MutationCtx, args: Args): Promise<Return> => {
		await requireMember(ctx, args.roomId);
		return handler(ctx, args);
	};
}

export function creatorMutation<Args extends RoomArgs, Return>(
	handler: (ctx: MutationCtx, args: Args) => Promise<Return>
) {
	return async (ctx: MutationCtx, args: Args): Promise<Return> => {
		await requireCreator(ctx, args.roomId);
		return handler(ctx, args);
	};
}

export function contributorMutation<Args extends RoomArgs, Return>(
	handler: (ctx: MutationCtx, args: Args) => Promise<Return>
) {
	return async (ctx: MutationCtx, args: Args): Promise<Return> => {
		await requireContributor(ctx, args.roomId);
		return handler(ctx, args);
	};
}
