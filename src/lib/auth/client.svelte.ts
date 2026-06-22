import { setupConvex } from 'convex-svelte';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { authClient } from '../auth-client.js';
import { browser } from '$app/environment';

export interface AuthState {
	isAuthenticated: boolean;
	user: { id: string; name?: string; email?: string; image?: string | null } | null;
}

class ReactiveAuthState implements AuthState {
	isAuthenticated = $state(false);
	user = $state<AuthState['user']>(null);
}

const authState = new ReactiveAuthState();

export function initConvexAuth(): () => void {
	setupConvex(PUBLIC_CONVEX_URL);

	if (!browser) {
		return () => {};
	}

	const session = authClient.useSession();
	const unsubscribe = session.subscribe((value) => {
		authState.isAuthenticated = !!value.data?.user;
		authState.user = value.data?.user ?? null;
	});

	return unsubscribe;
}

export function useAuth(): AuthState {
	return authState;
}
