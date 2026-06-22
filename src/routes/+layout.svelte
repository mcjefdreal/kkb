<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initConvexAuth } from '$lib/convex.js';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import Toasts from '$lib/components/Toasts.svelte';

	initConvexAuth();

	let { children } = $props();
	const auth = useAuth();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
	<a href="/" class="text-xl font-bold text-slate-800">KKB</a>
	<div class="flex items-center gap-4 text-sm">
		<a href="/dashboard" class="text-slate-600 hover:text-slate-900">Dashboard</a>
		<a href="/join" class="text-slate-600 hover:text-slate-900">Join</a>
		{#if auth.isAuthenticated}
			<a href="/profile" class="text-slate-600 hover:text-slate-900">Profile</a>
			<a href="/logout" class="text-slate-600 hover:text-slate-900">Log out</a>
		{:else}
			<a href="/login" class="text-slate-600 hover:text-slate-900">Log in</a>
		{/if}
	</div>
</nav>

<main class="mx-auto max-w-3xl p-6">
	{@render children()}
</main>

<Toasts />
