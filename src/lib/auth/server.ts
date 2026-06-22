import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

const SESSION_COOKIE = 'better-auth.session_token';

export function getSessionToken(cookies: { get(name: string): string | undefined }): string | undefined {
	return cookies.get(SESSION_COOKIE);
}

export function createAuthedHttpClient(token?: string): ConvexHttpClient {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	if (token) {
		client.setAuth(token);
	}
	return client;
}
