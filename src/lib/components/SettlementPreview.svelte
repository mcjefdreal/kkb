<script lang="ts">
	import type { Profile } from '$lib/types.js';
	import { formatPHP } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Transaction {
		payerUserId: string;
		payeeUserId: string;
		amountCentavos: number;
	}

	interface ChangeEntry {
		userId: string;
		amountCentavos: number;
	}

	interface Props {
		transactions: Transaction[];
		change: ChangeEntry[];
		unclaimedItems: { name: string; qty: number }[];
		fundingGap: number;
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		status: string;
	}

	let { transactions, change, unclaimedItems, fundingGap, profiles, status }: Props =
		$props();

	const fundingStatus = $derived(fundingGap > 0 ? 'under' : fundingGap < 0 ? 'over' : 'exact');

	const isCollecting = $derived(status === 'collecting');
</script>

<div class="rounded-lg border border-slate-200 p-4">
	<h2 class="mb-3 font-semibold">Settlement preview</h2>

	{#if isCollecting}
		<div class="mb-3 text-sm text-slate-500">
			This is a live preview; claims and contributions can still change.
		</div>
	{/if}

	{#if isCollecting && unclaimedItems.length > 0}
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

	{#if isCollecting && transactions.length > 0}
		<ul class="space-y-2">
			{#each transactions as t (t.payerUserId + t.payeeUserId)}
				<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
					<span>
						{profiles[t.payerUserId]?.displayName ?? 'Unknown'} → {profiles[t.payeeUserId]
							?.displayName ?? 'Unknown'}
					</span>
					<span class="font-medium">{formatPHP(t.amountCentavos)}</span>
				</li>
			{/each}
		</ul>
	{:else if isCollecting}
		<p class="text-sm text-slate-500">No payments needed.</p>
	{/if}

	{#if change.length > 0}
		<div class="mt-3">
			<div class="mb-1 flex items-center gap-1 text-sm font-medium text-blue-700">
				<span>Change to return</span>
				<HelpButton
					label="Help about change"
					text="Extra contributions beyond the bill total are returned as change after everyone settles what they owe."
				/>
			</div>
			<ul class="space-y-1">
				{#each change as c (c.userId)}
					<li class="flex items-center justify-between rounded bg-blue-50 px-3 py-1.5 text-sm">
						<span>{profiles[c.userId]?.displayName ?? 'Unknown'}</span>
						<span class="font-medium">{formatPHP(c.amountCentavos)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>