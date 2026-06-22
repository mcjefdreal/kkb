import type { PageServerLoad } from './$types.js';
import { loadRoomGuard } from '$lib/loaders/roomGuard.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	return loadRoomGuard(params.code.toUpperCase(), locals.token);
};
