<script lang="ts">
	import { toCentavos, formatPHP } from '$lib/money.js';

	export interface ItemInput {
		name: string;
		priceCentavos: number;
		qty: number;
	}

	interface Props {
		onItemsChange?: (items: ItemInput[]) => void;
	}

	let { onItemsChange }: Props = $props();

	interface Row {
		id: string;
		name: string;
		price: string;
		qty: number;
		error?: string;
	}

	let rows = $state<Row[]>([
		{ id: crypto.randomUUID(), name: '', price: '', qty: 1 }
	]);

	function notify() {
		const items: ItemInput[] = [];
		for (const row of rows) {
			try {
				items.push({
					name: row.name.trim(),
					priceCentavos: toCentavos(row.price),
					qty: row.qty
				});
				row.error = undefined;
			} catch (err) {
				row.error = err instanceof Error ? err.message : 'Invalid';
			}
		}
		onItemsChange?.(items);
	}

	function addRow() {
		rows = [...rows, { id: crypto.randomUUID(), name: '', price: '', qty: 1 }];
		notify();
	}

	function removeRow(id: string) {
		rows = rows.filter((r) => r.id !== id);
		notify();
	}

	function updateRow(id: string, patch: Partial<Row>) {
		rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
		notify();
	}

	const totalCentavos = $derived(
		rows.reduce((sum, row) => {
			try {
				return sum + toCentavos(row.price) * row.qty;
			} catch {
				return sum;
			}
		}, 0)
	);
</script>

<div class="space-y-3">
	{#each rows as row (row.id)}
		<div class="grid grid-cols-[1fr_120px_80px_40px] items-start gap-2">
			<input
				value={row.name}
				oninput={(e) => updateRow(row.id, { name: e.currentTarget.value })}
				placeholder="Item name"
				class="rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				value={row.price}
				oninput={(e) => updateRow(row.id, { price: e.currentTarget.value })}
				placeholder="0.00"
				class="rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				type="number"
				min="1"
				value={row.qty}
				oninput={(e) => updateRow(row.id, { qty: Number(e.currentTarget.value) })}
				class="rounded-lg border border-slate-300 px-3 py-2"
			/>
			<button
				type="button"
				onclick={() => removeRow(row.id)}
				class="text-red-600 hover:text-red-800"
			>
				×
			</button>
			{#if row.error}
				<span class="col-span-4 text-xs text-red-600">{row.error}</span>
			{/if}
		</div>
	{/each}
	<button
		type="button"
		onclick={addRow}
		class="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
	>
		+ Add item
	</button>
	<p class="text-right font-semibold">Total: {formatPHP(totalCentavos)}</p>
</div>
