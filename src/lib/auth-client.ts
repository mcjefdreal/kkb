import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

export const authClient = createAuthClient({
	baseUrl: PUBLIC_CONVEX_URL,
	plugins: [convexClient()]
});
