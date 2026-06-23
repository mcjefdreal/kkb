<script lang="ts">
	import type { SettlementPayment, Profile } from '$lib/types.js';
	import { paymentMethodLabel, paymentStatusLabel } from '$lib/labels.js';
	import { formatPHP } from '$lib/money.js';

	interface Props {
		payment: SettlementPayment;
		profiles: Record<string, Pick<Profile, 'displayName' | 'gcashNumber' | 'mayaNumber'>>;
		currentUserId: string;
		onMarkPaid: (method: 'cash' | 'gcash' | 'maya') => void;
		onUnmark: () => void;
		onConfirm: () => void;
	}

	let { payment, profiles, currentUserId, onMarkPaid, onUnmark, onConfirm }: Props = $props();

	const isPayer = payment.payerUserId === currentUserId;
	const isPayee = payment.payeeUserId === currentUserId;
	const payee = profiles[payment.payeeUserId];
	const hasGcash = !!payee?.gcashNumber;
	const hasMaya = !!payee?.mayaNumber;
</script>

<div class="rounded-lg border border-slate-200 p-4">
	<div class="flex items-center justify-between">
		<div>
			<p class="font-medium">
				{profiles[payment.payerUserId]?.displayName ?? 'Unknown'} → {payee?.displayName ?? 'Unknown'}
			</p>
			<p class="text-xs text-slate-500">{paymentStatusLabel[payment.status]}</p>
			{#if payment.method !== 'pending'}
				<p class="text-xs text-slate-500">{paymentMethodLabel[payment.method]}</p>
			{/if}
			{#if payment.reference}
				<p class="text-xs text-slate-400">Ref: {payment.reference}</p>
			{/if}
		</div>
		<div class="text-right">
			<p class="font-semibold">{formatPHP(payment.amountCentavos)}</p>
			{#if payment.status === 'pending' && isPayer}
				<div class="mt-2 flex gap-2">
					<button
						onclick={() => onMarkPaid('cash')}
						class="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
					>
						Cash
					</button>
					{#if hasGcash}
						<button
							onclick={() => onMarkPaid('gcash')}
							class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
						>
							GCash
						</button>
					{/if}
					{#if hasMaya}
						<button
							onclick={() => onMarkPaid('maya')}
							class="rounded bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100"
						>
							Maya
						</button>
					{/if}
				</div>
				{#if !hasGcash && !hasMaya}
					<p class="mt-1 text-xs text-amber-600">Payee has no e-wallet configured.</p>
				{/if}
			{:else if payment.status === 'pending_confirmation'}
				{#if isPayer}
					<button
						onclick={onUnmark}
						class="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
					>
						Unmark
					</button>
				{/if}
				{#if isPayee}
					<button
						onclick={onConfirm}
						class="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
					>
						Confirm
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
