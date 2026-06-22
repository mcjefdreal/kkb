import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ fetch }) => {
	await fetch('/api/auth/sign-out', { method: 'POST' });
	throw redirect(302, '/');
};
