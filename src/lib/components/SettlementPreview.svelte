<script lang="ts">
	import type { Profile } from '$lib/types.js';
	import { formatPHP } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Transaction {
		payerUserId: string;
		payeeUserId: string;
		amountCentavos: number;
	}

	interface Props {
		transactions: Transaction[];
		residueCentavos: number;
		unclaimedItems: { name: string; qty: number }[];
		fundingGap: number;
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		status: string;
	}

	let { transactions, residueCentavos, unclaimedItems, fundingGap, profiles, status }: Props = $props();

	const fundingStatus = $derived(
		fundingGap > 0 ? 'under' : fundingGap < 0 ? 'over' : 'exact'
	);
</script>

<div class="rounded-lg border border-slate-200 p-4">
	<h2 class="mb-3 font-semibold">Settlement preview</h2>

	{#if status === 'collecting'}
		<div class="mb-3 text-sm text-slate-500">This is a live preview; claims and contributions can still change.</div>
	{/if}

	{#if unclaimedItems.length > 0}
		<div class="mb-3 text-sm text-amber-700">
			Unallocated items: {unclaimedItems.map((i) => i.name).join(', ')}
		</div>
	{/if}

	<div class="mb-3 flex items-center gap-2 text-sm">
		<span>Funding:</span>
		<HelpButton
			label="Help about funding status"
			text="Under = total contributions are less than the bill. Over = there's extra to return. Exact = balanced."
		/>
		{#if fundingStatus === 'exact'}
			<span class="font-medium text-green-700">exact</span>
		{:else if fundingStatus === 'under'}
			<span class="font-medium text-red-700">under by {formatPHP(fundingGap)}</span>
		{:else}
			<span class="font-medium text-blue-700">over by {formatPHP(-fundingGap)}</span>
		{/if}
	</div>

	{#if transactions.length > 0}
		<ul class="space-y-2">
			{#each transactions as t (t.payerUserId + t.payeeUserId)}
				<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
					<span>
						{profiles[t.payerUserId]?.displayName ?? 'Unknown'} → {profiles[t.payeeUserId]?.displayName ?? 'Unknown'}
					</span>
					<span class="font-medium">{formatPHP(t.amountCentavos)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-slate-500">No payments needed.</p>
	{/if}

	{#if residueCentavos > 0}
		<p class="mt-2 text-xs text-slate-500">1¢ residue assigned to largest creditor.</p>
	{/if}
</div>
