<script lang="ts">
	import type { Item, ItemClaim, Profile } from '$lib/types.js';
	import { formatPHP, toCentavos } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Props {
		items: Item[];
		claims: ItemClaim[];
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		currentUserId: string;
		editable: boolean;
		isCreator: boolean;
		onSetClaim: (itemId: string, shares: number) => void;
		onSaveItem?: (itemId: string, name: string, priceCentavos: number, qty: number) => void;
	}

	let { items, claims, profiles, currentUserId, editable, isCreator, onSetClaim, onSaveItem }: Props =
		$props();

	let editingItemId = $state<string | null>(null);

	// Per-item edit state keyed by item._id
	let editName = $state<Record<string, string>>({});
	let editPrice = $state<Record<string, string>>({});
	let editQty = $state<Record<string, number>>({});

	function startEdit(item: Item) {
		editingItemId = item._id;
		editName[item._id] = item.name;
		editPrice[item._id] = (item.priceCentavos / 100).toFixed(2);
		editQty[item._id] = item.qty;
		// Trigger reactivity
		editName = { ...editName };
		editPrice = { ...editPrice };
		editQty = { ...editQty };
	}

	function cancelEdit() {
		editingItemId = null;
	}

	function claimsFor(itemId: string) {
		return claims.filter((c) => c.itemId === itemId);
	}

	function ownClaim(itemId: string) {
		return claimsFor(itemId).find((c) => c.userId === currentUserId)?.shares ?? 0;
	}

	function claimedTotal(itemId: string) {
		return claimsFor(itemId).reduce((sum, c) => sum + c.shares, 0);
	}

	function handleChange(itemId: string, value: string) {
		const shares = value === '' ? 0 : Math.max(0, Number(value));
		onSetClaim(itemId, shares);
	}

	async function handleSave(item: Item) {
		if (!onSaveItem) return;
		const trimmedName = editName[item._id]?.trim() ?? '';
		if (!trimmedName) return;
		let priceCentavos: number;
		try {
			priceCentavos = toCentavos(editPrice[item._id] ?? '');
		} catch {
			return;
		}
		if (priceCentavos <= 0) return;
		const qty = editQty[item._id] ?? 0;
		if (qty <= 0) return;
		editingItemId = null;
		await onSaveItem(item._id, trimmedName, priceCentavos, qty);
	}
</script>

<div class="space-y-3">
	{#each items as item (item._id)}
		{@const claimed = claimedTotal(item._id)}
		{@const remaining = item.qty - claimed + ownClaim(item._id)}
		{@const editing = editingItemId === item._id}
		<div class="rounded-lg border border-slate-200 p-4">
			{#if editing}
				<div class="grid grid-cols-[1fr_120px_80px_auto] items-center gap-2">
					<input
						bind:value={editName[item._id]}
						placeholder="Item name"
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
					/>
					<input
						bind:value={editPrice[item._id]}
						placeholder="0.00"
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
					/>
					<input
						type="number"
						min="1"
						bind:value={editQty[item._id]}
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
					/>
					<div class="flex items-center gap-1">
						<button
							onclick={() => handleSave(item)}
							class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Save
						</button>
						<button
							onclick={cancelEdit}
							class="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">{item.name}</p>
						<p class="text-xs text-slate-500">
							{formatPHP(item.priceCentavos)} × {item.qty} = {formatPHP(item.priceCentavos * item.qty)}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm">{claimed}/{item.qty} claimed</span>
						<HelpButton
							id="claim-{item._id}"
							label="Help about claiming items"
							text="Enter how many of this item you'll cover. Unallocated shares are split by contributions."
						/>
						<input
							type="number"
							min="0"
							max={remaining}
							value={ownClaim(item._id) || ''}
							oninput={(e) => handleChange(item._id, e.currentTarget.value)}
							disabled={!editable}
							class="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
						/>
						{#if isCreator && editable && onSaveItem}
							<button
								onclick={() => startEdit(item)}
								class="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
							>
								Edit
							</button>
						{/if}
					</div>
				</div>
			{/if}
			{#if claimsFor(item._id).length > 0}
				<div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
					{#each claimsFor(item._id) as claim (claim._id)}
						<span class="rounded-full bg-slate-100 px-2 py-1">
							{profiles[claim.userId]?.displayName ?? 'Unknown'}: {claim.shares}
						</span>
					{/each}
				</div>
			{/if}
			{#if claimed < item.qty}
				<p class="mt-1 text-xs text-amber-600">{item.qty - claimed} unallocated</p>
			{/if}
		</div>
	{/each}
</div>
