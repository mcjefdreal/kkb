<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQuery, useMutation } from '@mmailaender/convex-svelte';
	import { api } from '$lib/convex-api.js';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';

	let code = $state('');
	let checkedCode = $state<string | null>(null);

	$effect(() => {
		const normalized = code.trim().toUpperCase();
		checkedCode = normalized.length === 8 ? normalized : null;
	});

	const lookup = useQuery(api.queries.getRoomByCode, () =>
		checkedCode ? { code: checkedCode } : 'skip'
	);
	const joinRoom = useMutation(api.rooms.joinRoom);
	let joining = $state(false);

	async function join() {
		const normalized = code.trim().toUpperCase();
		if (normalized.length !== 8) {
			toasts.add('Enter an 8-character room code', 'error');
			return;
		}
		joining = true;
		try {
			const roomId = await joinRoom({ code: normalized });
			toasts.add('Joined room', 'success');
			goto(`/rooms/${normalized}`);
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Join failed', 'error');
			joining = false;
		}
	}
</script>

<h1 class="mb-6 text-2xl font-bold">Join a room</h1>

<ErrorBoundary error={lookup.error}>
<div class="mx-auto max-w-sm space-y-4">
	<div>
		<label class="block text-sm font-medium" for="code">Room code</label>
		<input
			id="code"
			bind:value={code}
			maxlength={8}
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
		/>
	</div>
	<button
		onclick={join}
		disabled={joining}
		class="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
	>
		{#if joining}
			<Spinner size={18} />
		{:else}
			Join
		{/if}
	</button>

	{#if checkedCode && lookup.isLoading}
		<p class="text-sm text-slate-500">Checking...</p>
	{:else if lookup.data}
		<p class="text-sm text-green-700">Room found.</p>
	{:else if checkedCode && !lookup.isLoading}
		<p class="text-sm text-red-700">Room not found.</p>
	{/if}
</div>
</ErrorBoundary>
