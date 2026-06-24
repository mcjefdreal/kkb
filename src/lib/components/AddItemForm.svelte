<script lang="ts">
	import { useMutation } from 'convex-svelte';
	import { api } from '$lib/convex-api.js';
	import { toCentavos } from '$lib/money.js';
	import { friendlyError } from '$lib/errors.js';
	import { toasts } from '$lib/stores/toast.js';
	import type { Id } from '../../../convex/_generated/dataModel.js';

	interface Props {
		roomId: Id<'rooms'>;
	}

	let { roomId }: Props = $props();

	const addItem = useMutation(api.items.addItem);

	let showForm = $state(false);
	let name = $state('');
	let price = $state('');
	let qty = $state(1);
	let saving = $state(false);

	function reset() {
		name = '';
		price = '';
		qty = 1;
		showForm = false;
		saving = false;
	}

	async function handleAdd() {
		if (saving) return;
		const trimmedName = name.trim();
		if (!trimmedName) {
			toasts.add('Item name is required', 'error');
			return;
		}
		if (!price.trim()) {
			toasts.add('Amount is required', 'error');
			return;
		}
		let priceCentavos: number;
		try {
			priceCentavos = toCentavos(price);
		} catch (err) {
			toasts.add(friendlyError(err, 'Invalid price'), 'error');
			return;
		}
		if (priceCentavos <= 0) {
			toasts.add('Price must be greater than 0', 'error');
			return;
		}
		if (qty <= 0) {
			toasts.add('Quantity must be greater than 0', 'error');
			return;
		}
		saving = true;
		try {
			await addItem({ roomId, name: trimmedName, priceCentavos, qty });
			toasts.add('Item added', 'success');
			reset();
		} catch (err) {
			toasts.add(friendlyError(err, 'Failed to add item'), 'error');
			saving = false;
		}
	}
</script>

{#if showForm}
	<div class="grid grid-cols-[1fr_120px_80px_auto] items-center gap-2">
		<input
			bind:value={name}
			placeholder="Item name"
			disabled={saving}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
		/>
		<input
			bind:value={price}
			placeholder="0.00"
			disabled={saving}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
		/>
		<input
			type="number"
			min="1"
			bind:value={qty}
			disabled={saving}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
		/>
		<div class="flex items-center gap-1">
			<button
				onclick={handleAdd}
				disabled={saving}
				class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
			>
				{saving ? 'Adding…' : 'Add'}
			</button>
			<button
				onclick={reset}
				disabled={saving}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
			>
				Cancel
			</button>
		</div>
	</div>
{:else}
	<button
		onclick={() => (showForm = true)}
		class="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
	>
		+ Add item
	</button>
{/if}
