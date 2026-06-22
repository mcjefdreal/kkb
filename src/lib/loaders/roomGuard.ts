import { error, redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { api } from '$lib/convex-api.js';

export async function loadRoomGuard(code: string) {
	const client = createConvexHttpClient();
	const room = await client.query(api.queries.getRoomByCode, { code });
	if (!room) {
		throw error(404, 'Room not found');
	}
	if (!room.alreadyMember) {
		throw redirect(302, `/join?code=${code}`);
	}
	return { code, roomId: room.roomId };
}
