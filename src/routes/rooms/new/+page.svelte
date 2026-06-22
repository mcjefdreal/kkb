<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAction } from '@mmailaender/convex-svelte';
	import { api } from '$lib/convex-api.js';
	import ItemEditor, { type ItemInput } from '$lib/components/ItemEditor.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toCentavos, formatPHP } from '$lib/money.js';
	import { toasts } from '$lib/stores/toast.js';

	const createRoom = useAction(api.rooms.createRoom);

	let name = $state('');
	let items = $state<ItemInput[]>([]);
	let ownContribution = $state('');
	let loading = $state(false);

	const totalCentavos = $derived(
		items.reduce((sum, item) => sum + item.priceCentavos * item.qty, 0)
	);

	$effect(() => {
		if (ownContribution === '') {
			ownContribution = (totalCentavos / 100).toFixed(2);
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		if (!name.trim()) {
			toasts.add('Room name is required', 'error');
			return;
		}
		if (items.length === 0) {
			toasts.add('Add at least one item', 'error');
			return;
		}
		let ownContributionCentavos: number;
		try {
			ownContributionCentavos = toCentavos(ownContribution);
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Invalid contribution', 'error');
			return;
		}
		loading = true;
		try {
			const code = await createRoom({
				name: name.trim(),
				items,
				ownContributionCentavos
			});
			toasts.add('Room created', 'success');
			goto(`/rooms/${code}`);
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Create failed', 'error');
			loading = false;
		}
	}
</script>

<h1 class="mb-6 text-2xl font-bold">New room</h1>

<form onsubmit={submit} class="space-y-6">
	<div>
		<label class="block text-sm font-medium" for="name">Room name</label>
		<input
			id="name"
			bind:value={name}
			required
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
		/>
	</div>

	<div>
		<label class="block text-sm font-medium">Items</label>
		<ItemEditor onItemsChange={(next) => (items = next)} />
	</div>

	<div>
		<label class="block text-sm font-medium" for="own">Your contribution</label>
		<input
			id="own"
			bind:value={ownContribution}
			placeholder="0.00"
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
		/>
		<p class="mt-1 text-xs text-slate-500">Total: {formatPHP(totalCentavos)}</p>
	</div>

	<button
		type="submit"
		disabled={loading}
		class="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
	>
		{#if loading}
			<Spinner size={18} />
		{:else}
			Create room
		{/if}
	</button>
</form>
