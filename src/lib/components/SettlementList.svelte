<script lang="ts">
	import type { SettlementPayment, Profile } from '$lib/types.js';
	import PaymentCard from './PaymentCard.svelte';

	interface Props {
		payments: SettlementPayment[];
		profiles: Record<string, Pick<Profile, 'displayName' | 'gcashNumber' | 'mayaNumber'>>;
		currentUserId: string;
		onMarkPaid: (paymentId: string, method: 'cash' | 'gcash' | 'maya') => void;
		onUnmark: (paymentId: string) => void;
		onConfirm: (paymentId: string) => void;
	}

	let { payments, profiles, currentUserId, onMarkPaid, onUnmark, onConfirm }: Props = $props();
</script>

<div class="space-y-3">
	{#each payments as payment (payment._id)}
		<PaymentCard
			{payment}
			{profiles}
			{currentUserId}
			onMarkPaid={(method) => onMarkPaid(payment._id, method)}
			onUnmark={() => onUnmark(payment._id)}
			onConfirm={() => onConfirm(payment._id)}
		/>
	{/each}
</div>
