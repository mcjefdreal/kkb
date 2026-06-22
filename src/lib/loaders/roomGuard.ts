import { error, redirect } from '@sveltejs/kit';
import { createAuthedHttpClient } from '$lib/auth/server.js';
import { api } from '$lib/convex-api.js';

export async function loadRoomGuard(code: string, token?: string) {
	const client = createAuthedHttpClient(token);
	const room = await client.query(api.queries.getRoomByCode, { code });
	if (!room) {
		throw error(404, 'Room not found');
	}
	if (!room.alreadyMember) {
		throw redirect(302, `/join?code=${code}`);
	}
	return { code, roomId: room.roomId };
}
