import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
import { authClient } from './auth-client.js';

export function initConvexAuth() {
	return createSvelteAuthClient({ authClient });
}
