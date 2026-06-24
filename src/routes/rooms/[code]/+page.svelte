<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQuery, useMutation } from 'convex-svelte';
	import { useAuth } from '$lib/auth/client.svelte.js';
	import { api } from '$lib/convex-api.js';
	import { roomStatusLabel } from '$lib/labels.js';
	import { friendlyError } from '$lib/errors.js';
	import ItemClaimGrid from '$lib/components/ItemClaimGrid.svelte';
	import MemberList from '$lib/components/MemberList.svelte';
	import SettlementPreview from '$lib/components/SettlementPreview.svelte';
	import SettlementList from '$lib/components/SettlementList.svelte';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import { toasts } from '$lib/stores/toast.js';
	import type { Id } from '../../../convex/_generated/dataModel.js';

	let { data } = $props();
	const auth = useAuth();

	const roomState = useQuery(api.queries.getRoomState, () => ({ roomId: data.roomId }));
	const preview = useQuery(api.queries.previewSettlement, () => ({ roomId: data.roomId }));

	const setClaim = useMutation(api.claims.setClaim);
	const setContribution = useMutation(api.rooms.setContribution);
	const setRole = useMutation(api.rooms.setMemberRole);
	const finalize = useMutation(api.rooms.finalizeSettlement);
	const markPaid = useMutation(api.rooms.markPaid);
	const unmarkPaid = useMutation(api.rooms.unmarkPaid);
	const confirmPayment = useMutation(api.rooms.confirmPayment);
	const deleteRoom = useMutation(api.rooms.deleteRoom);

	const currentUserId = $derived(auth.user?.id ?? '');
	const isCreator = $derived(
		!!roomState.data && roomState.data.room.createdBy === currentUserId
	);
	const editable = $derived(roomState.data?.room.status === 'collecting');
	const paymentProgress = $derived(
		roomState.data
			? {
					paid: roomState.data.settlements.filter((p) => p.status === 'paid').length,
					total: roomState.data.settlements.length
				}
			: { paid: 0, total: 0 }
	);

	const creditorsWithoutWallet = $derived(
		(() => {
			if (!preview.data || !roomState.data) return [];
			const payees = new Set(preview.data.transactions.map((t) => t.payeeUserId));
			return Array.from(payees).filter((userId) => {
				const p = roomState.data!.profiles[userId];
				return !p?.gcashNumber && !p?.mayaNumber;
			});
		})()
	);

	async function handleSetClaim(itemId: string, shares: number) {
		try {
			await setClaim({ itemId, shares });
		} catch (err) {
			toasts.add(friendlyError(err, 'Claim failed'), 'error');
		}
	}

	async function handleSetContribution(amountCentavos: number) {
		try {
			await setContribution({ roomId: data.roomId, amountCentavos });
		} catch (err) {
			toasts.add(friendlyError(err, 'Contribution failed'), 'error');
		}
	}

	async function handleSetRole(targetUserId: string, role: 'member' | 'contributor') {
		try {
			await setRole({ roomId: data.roomId, targetUserId, role });
		} catch (err) {
			toasts.add(friendlyError(err, 'Role change failed'), 'error');
		}
	}

	async function handleFinalize() {
		try {
			await finalize({ roomId: data.roomId });
			toasts.add('Room locked for settlement', 'success');
		} catch (err) {
			toasts.add(friendlyError(err, 'Finalize failed'), 'error');
		}
	}

	async function handleMarkPaid(paymentId: string, method: 'cash' | 'gcash' | 'maya') {
		try {
			await markPaid({ settlementId: paymentId as unknown as Id<'settlementPayments'>, method });
		} catch (err) {
			toasts.add(friendlyError(err, 'Payment failed'), 'error');
		}
	}

	async function handleUnmark(paymentId: string) {
		try {
			await unmarkPaid({ settlementId: paymentId as unknown as Id<'settlementPayments'> });
		} catch (err) {
			toasts.add(friendlyError(err, 'Undo failed'), 'error');
		}
	}

	async function handleConfirm(paymentId: string) {
		try {
			await confirmPayment({ settlementId: paymentId as unknown as Id<'settlementPayments'> });
		} catch (err) {
			toasts.add(friendlyError(err, 'Confirm failed'), 'error');
		}
	}

	async function handleDeleteRoom() {
		if (!confirm('Delete this room permanently?')) return;
		try {
			await deleteRoom({ roomId: data.roomId });
			toasts.add('Room deleted', 'success');
			goto('/dashboard');
		} catch (err) {
			toasts.add(friendlyError(err, 'Delete failed'), 'error');
		}
	}
</script>

{#if roomState.isLoading || !roomState.data}
	<Spinner />
{:else}
	{@const state = roomState.data}
	<ErrorBoundary error={roomState.error}>
		<div class="space-y-6">
			<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold">{state.room.name}</h1>
				<p class="font-mono text-sm text-slate-500">Code: {data.code}</p>
				<p class="flex items-center gap-1 text-xs uppercase text-slate-400">
					{roomStatusLabel[state.room.status]}
					<HelpButton
						label="Help about room status"
						text="Collecting = adding items and contributions. Settling = payments in progress. Settled = all payments confirmed."
					/>
				</p>
				{#if paymentProgress.total > 0}
					<p class="text-xs text-slate-500">
						Payments: {paymentProgress.paid}/{paymentProgress.total} paid
					</p>
				{/if}
			</div>
			{#if isCreator && editable}
				<div class="text-right">
					{#if creditorsWithoutWallet.length > 0}
						<p class="mb-1 text-xs text-amber-700">
							Warning: creditors without e-wallet may only be paid cash.
						</p>
					{/if}
					<div class="flex items-center justify-end gap-2">
						<button
							onclick={handleFinalize}
							class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Lock & settle
						</button>
						<HelpButton
							label="Help about locking the room"
							text="Locks the room, computes who owes whom, and starts payments. You can only reopen while no payments are in progress."
						/>
					</div>
				</div>
			{/if}
			{#if isCreator && state.room.status === 'settled'}
				<div class="text-right">
					<button
						onclick={handleDeleteRoom}
						class="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
					>
						Delete room
					</button>
				</div>
			{/if}
		</div>

		<section>
			<h2 class="mb-2 font-semibold">Items</h2>
			<ItemClaimGrid
				items={state.items}
				claims={state.claims}
				profiles={state.profiles}
				currentUserId={currentUserId}
				editable={editable}
				onSetClaim={handleSetClaim}
			/>
		</section>

		<section>
			<h2 class="mb-2 font-semibold">Members</h2>
			<MemberList
				members={state.members}
				contributions={state.contributions}
				profiles={state.profiles}
				currentUserId={currentUserId}
				isCreator={isCreator}
				onSetRole={handleSetRole}
				onSetContribution={handleSetContribution}
			/>
		</section>

		{#if preview.data}
			<SettlementPreview
				transactions={preview.data.transactions}
				change={preview.data.change}
				unclaimedItems={preview.data.unclaimedItems}
				fundingGap={preview.data.fundingGap}
				profiles={state.profiles}
				status={state.room.status}
			/>
		{/if}

		{#if state.settlements.length > 0}
			<section>
				<h2 class="mb-2 font-semibold">Payments</h2>
				<SettlementList
					payments={state.settlements}
					profiles={state.profiles}
					currentUserId={currentUserId}
					onMarkPaid={handleMarkPaid}
					onUnmark={handleUnmark}
					onConfirm={handleConfirm}
				/>
			</section>
		{/if}
		</div>
	</ErrorBoundary>
{/if}
