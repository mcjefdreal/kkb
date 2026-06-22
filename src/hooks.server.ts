import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { createAuth } from '../convex/betterAuth/auth.js';
import { getToken, getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';

const PUBLIC_PATHS = ['/', '/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const isPublic =
		PUBLIC_PATHS.includes(event.url.pathname) || event.url.pathname.startsWith('/api/auth/');

	const token = await getToken(createAuth, event.cookies);
	event.locals.token = token;

	return withServerConvexToken(token, async () => {
		const authState = getAuthState();
		event.locals.isAuthenticated = authState.isAuthenticated;
		event.locals.user = authState.user ?? null;

		if (!isPublic && !token) {
			throw redirect(302, '/login');
		}

		return resolve(event);
	});
};
