import type { PageServerLoad } from './$types.js';
import { loadRoomGuard } from '$lib/loaders/roomGuard.js';

export const load: PageServerLoad = async ({ params }) => {
	return loadRoomGuard(params.code.toUpperCase());
};
