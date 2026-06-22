import { query } from './_generated/server.js';

export const whoami = query({
	args: {},
	handler: async (ctx) => ctx.auth.getUserIdentity()
});
