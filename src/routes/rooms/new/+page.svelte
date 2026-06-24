<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAction } from 'convex-svelte';
	import { api } from '$lib/convex-api.js';
	import ItemEditor, { type ItemInput } from '$lib/components/ItemEditor.svelte';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toCentavos, formatPHP } from '$lib/money.js';
	import { toasts } from '$lib/stores/toast.js';
	import { friendlyError } from '$lib/errors.js';

	const createRoom = useAction(api.rooms.createRoom);

	let name = $state('');
	let items = $state<ItemInput[]>([]);
	let ownContribution = $state('0.00');
	let loading = $state(false);
	let createError = $state<string | null>(null);

	const totalCentavos = $derived(
		items.reduce((sum, item) => sum + item.priceCentavos * item.qty, 0)
	);

	async function submit(e: Event) {
		e.preventDefault();
		createError = null;
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
			toasts.add(friendlyError(err, 'Invalid contribution'), 'error');
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
			createError = friendlyError(err, 'Create failed');
			toasts.add(createError, 'error');
			loading = false;
		}
	}
</script>

<h1 class="mb-6 text-2xl font-bold">New room</h1>

<ErrorBoundary error={createError}>
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
			<p class="mt-1 text-xs text-slate-500">
				Total: {formatPHP(totalCentavos)} — you can contribute more; the extra returns to you as change.
			</p>
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
</ErrorBoundary>
