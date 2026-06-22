<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';

	let loading = $state(false);

	async function signIn() {
		loading = true;
		const result = await authClient.signIn.social({
			provider: 'google',
			callbackURL: '/'
		});
		if (result.error) {
			toasts.add(result.error.message ?? 'Sign in failed', 'error');
		}
		loading = false;
	}
</script>

<div class="mx-auto max-w-sm rounded-xl border border-slate-200 p-6 text-center shadow-sm">
	<h1 class="mb-2 text-2xl font-bold">Welcome to KKB</h1>
	<p class="mb-6 text-slate-600">Split bills with friends.</p>
	<button
		onclick={signIn}
		disabled={loading}
		class="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
	>
		{#if loading}
			<Spinner size={18} />
		{/if}
		Sign in with Google
	</button>
</div>
