// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			token: string | undefined;
			user: { id: string; name?: string; email?: string; image?: string | null } | null;
			isAuthenticated: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
