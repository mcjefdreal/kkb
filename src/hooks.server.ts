import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSessionToken } from '$lib/auth/server.js';

const PUBLIC_PATHS = ['/', '/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const isPublic = PUBLIC_PATHS.includes(event.url.pathname);

	const token = getSessionToken(event.cookies);
	event.locals.token = token;
	event.locals.isAuthenticated = !!token;
	event.locals.user = null;

	if (!isPublic && !token) {
		throw redirect(302, '/login');
	}

	return resolve(event);
};
