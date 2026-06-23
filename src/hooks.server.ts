import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSessionToken, getJwtToken } from '$lib/auth/server.js';

const PUBLIC_PATHS = ['/', '/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const isPublic = PUBLIC_PATHS.includes(event.url.pathname);

	const sessionToken = getSessionToken(event.cookies);
	const jwt = getJwtToken(event.cookies);
	event.locals.token = jwt;
	event.locals.isAuthenticated = !!sessionToken;
	event.locals.user = null;

	if (!isPublic && !sessionToken) {
		throw redirect(302, '/login');
	}

	return resolve(event);
};
