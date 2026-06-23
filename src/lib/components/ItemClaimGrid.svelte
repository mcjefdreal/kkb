<script lang="ts">
	import type { Item, ItemClaim, Profile } from '$lib/types.js';
	import { formatPHP } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Props {
		items: Item[];
		claims: ItemClaim[];
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		currentUserId: string;
		editable: boolean;
		onSetClaim: (itemId: string, shares: number) => void;
	}

	let { items, claims, profiles, currentUserId, editable, onSetClaim }: Props = $props();

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
</script>

<div class="space-y-3">
	{#each items as item (item._id)}
		{@const claimed = claimedTotal(item._id)}
		{@const remaining = item.qty - claimed + ownClaim(item._id)}
		<div class="rounded-lg border border-slate-200 p-4">
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
				</div>
			</div>
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
