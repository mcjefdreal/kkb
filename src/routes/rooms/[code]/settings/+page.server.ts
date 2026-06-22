import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '../$types.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { api } from '$lib/convex-api.js';

export const load: PageServerLoad = async ({ params }) => {
	const code = params.code.toUpperCase();
	const client = createConvexHttpClient();
	const room = await client.query(api.queries.getRoomByCode, { code });
	if (!room) {
		throw error(404, 'Room not found');
	}
	if (!room.alreadyMember) {
		throw redirect(302, `/join?code=${code}`);
	}
	return { code, roomId: room.roomId };
};
