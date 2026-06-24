<script lang="ts">
	import { useAuth } from '$lib/auth/client.svelte.js';
	import QuickGuide from '$lib/components/QuickGuide.svelte';

	const auth = useAuth();
</script>

<div class="py-12 text-center">
	<h1 class="mb-4 text-4xl font-bold">KKB</h1>
	<p class="mb-8 text-lg text-slate-600">No more utang. Enjoy lang.</p>
	{#if auth.isAuthenticated}
		<a href="/dashboard" class="rounded-lg bg-slate-900 px-6 py-3 text-white hover:bg-slate-800">
			Go to dashboard
		</a>
	{:else}
		<a href="/login" class="rounded-lg bg-slate-900 px-6 py-3 text-white hover:bg-slate-800">
			Sign in with Google
		</a>
	{/if}
</div>

<QuickGuide />
