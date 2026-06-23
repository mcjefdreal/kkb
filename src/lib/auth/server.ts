import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

const SESSION_COOKIE = 'better-auth.session_token';
const JWT_COOKIE = 'better-auth.convex_jwt';
const SECURE_PREFIX = '__Secure-';

export function getSessionToken(cookies: {
	get(name: string): string | undefined;
}): string | undefined {
	return cookies.get(`${SECURE_PREFIX}${SESSION_COOKIE}`) ?? cookies.get(SESSION_COOKIE);
}

export function getJwtToken(cookies: {
	get(name: string): string | undefined;
}): string | undefined {
	return cookies.get(`${SECURE_PREFIX}${JWT_COOKIE}`) ?? cookies.get(JWT_COOKIE);
}

export function createAuthedHttpClient(jwt?: string): ConvexHttpClient {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	if (jwt) {
		client.setAuth(jwt);
	}
	return client;
}
