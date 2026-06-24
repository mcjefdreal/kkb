<script lang="ts">
	import type { SettlementPayment, Profile } from '$lib/types.js';
	import { paymentMethodLabel, paymentStatusLabel } from '$lib/labels.js';
	import { formatPHP } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Props {
		payment: SettlementPayment;
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		currentUserId: string;
		onMarkPaid: (method: 'cash' | 'gcash' | 'maya') => void;
		onUnmark: () => void;
		onConfirm: () => void;
	}

	let { payment, profiles, currentUserId, onMarkPaid, onUnmark, onConfirm }: Props = $props();

	const isPayer = payment.payerUserId === currentUserId;
	const isPayee = payment.payeeUserId === currentUserId;
	const payee = profiles[payment.payeeUserId];
</script>

<div class="rounded-lg border border-slate-200 p-4">
	<div class="flex items-center justify-between">
		<div>
			<p class="font-medium">
				{profiles[payment.payerUserId]?.displayName ?? 'Unknown'} → {payee?.displayName ?? 'Unknown'}
			</p>
			<p class="flex items-center gap-1 text-xs text-slate-500">
				{paymentStatusLabel[payment.status]}
				<HelpButton
					id="payment-status-{payment._id}"
					label="Help about payment status"
					text="The payer picks a method and marks it sent. The payee then confirms receipt. Cash and e-wallets both require payee confirmation."
				/>
			</p>
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
					<button
						onclick={() => onMarkPaid('gcash')}
						class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
					>
						GCash
					</button>
					<button
						onclick={() => onMarkPaid('maya')}
						class="rounded bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100"
					>
						Maya
					</button>
				</div>
			{:else if payment.status === 'pending_confirmation'}
				<div class="mt-2 flex items-center justify-end gap-2">
					<HelpButton
						id="payment-actions-{payment._id}"
						label="Help about undo and confirm"
						text="Payer: Undo reverts the payment to pending. Payee: Confirm marks the payment as received."
					/>
					{#if isPayer}
						<button
							onclick={onUnmark}
							aria-label="Undo payment"
							class="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
						>
							Undo
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
				</div>
			{/if}
		</div>
	</div>
</div>
