import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server.js';
import { api } from './_generated/api.js';
import { authComponent, createAuth } from './betterAuth/auth.js';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

function unauthorized() {
	return jsonResponse({ error: 'Unauthorized' }, 401);
}

function checkBotAuth(request: Request): boolean {
	const header = request.headers.get('authorization') ?? '';
	const key = header.startsWith('Bearer ') ? header.slice(7) : '';
	return key === process.env.BOT_API_KEY;
}

http.route({
	path: '/api/bot/health',
	method: 'GET',
	handler: httpAction(async () => jsonResponse({ ok: true }))
});

http.route({
	path: '/api/bot/rooms',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		if (!checkBotAuth(request)) {
			return unauthorized();
		}
		const url = new URL(request.url);
		const code = url.searchParams.get('code') ?? '';
		const room = await ctx.runQuery(api.queries.getRoomByCode, { code });
		if (!room) {
			return jsonResponse({ error: 'Room not found' }, 404);
		}
		return jsonResponse(room);
	})
});

export default http;
