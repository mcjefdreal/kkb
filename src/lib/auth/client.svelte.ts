import { setupConvex, setupAuth } from 'convex-svelte';
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

	let sessionLoading = $state(true);
	let sessionAuthed = $state(false);

	const unsubscribe = session.subscribe((value) => {
		sessionLoading = value.isPending;
		sessionAuthed = !!value.data?.user;
		authState.isAuthenticated = !!value.data?.user;
		authState.user = value.data?.user ?? null;
	});

	setupAuth(() => ({
		isLoading: sessionLoading,
		isAuthenticated: sessionAuthed,
		fetchAccessToken: async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			const url = forceRefreshToken
				? '/api/auth/convex/token?refresh=true'
				: '/api/auth/convex/token';
			const res = await fetch(url, { credentials: 'include' });
			if (!res.ok) return null;
			const data = await res.json();
			return data.token;
		}
	}));

	return unsubscribe;
}

export function useAuth(): AuthState {
	return authState;
}
