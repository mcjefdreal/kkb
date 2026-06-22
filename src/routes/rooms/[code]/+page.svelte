<script lang="ts">
	import { useQuery, useMutation } from '@mmailaender/convex-svelte';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { api } from '$lib/convex-api.js';
	import ItemClaimGrid from '$lib/components/ItemClaimGrid.svelte';
	import MemberList from '$lib/components/MemberList.svelte';
	import SettlementPreview from '$lib/components/SettlementPreview.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';

	let { data } = $props();
	const auth = useAuth();

	const roomState = useQuery(api.queries.getRoomState, () => ({ roomId: data.roomId }));
	const preview = useQuery(api.queries.previewSettlement, () => ({ roomId: data.roomId }));

	const setClaim = useMutation(api.claims.setClaim);
	const setContribution = useMutation(api.rooms.setContribution);
	const setRole = useMutation(api.rooms.setMemberRole);
	const finalize = useMutation(api.rooms.finalizeSettlement);

	const currentUserId = $derived(auth.user?.id ?? '');
	const isCreator = $derived(
		!!roomState.data && roomState.data.room.createdBy === currentUserId
	);
	const totalCentavos = $derived(
		roomState.data?.items.reduce((sum, i) => sum + i.priceCentavos * i.qty, 0) ?? 0
	);
	const editable = $derived(roomState.data?.room.status === 'collecting');

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
			toasts.add(err instanceof Error ? err.message : 'Claim failed', 'error');
		}
	}

	async function handleSetContribution(amountCentavos: number) {
		try {
			await setContribution({ roomId: data.roomId, amountCentavos });
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Contribution failed', 'error');
		}
	}

	async function handleSetRole(targetUserId: string, role: 'member' | 'contributor') {
		try {
			await setRole({ roomId: data.roomId, targetUserId, role });
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Role change failed', 'error');
		}
	}

	async function handleFinalize() {
		try {
			await finalize({ roomId: data.roomId });
			toasts.add('Room locked for settlement', 'success');
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Finalize failed', 'error');
		}
	}
</script>

{#if roomState.isLoading || !roomState.data}
	<Spinner />
{:else}
	{@const state = roomState.data}
	<div class="space-y-6">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold">{state.room.name}</h1>
				<p class="font-mono text-sm text-slate-500">Code: {data.code}</p>
				<p class="text-xs uppercase text-slate-400">{state.room.status}</p>
			</div>
			{#if isCreator && editable}
				<div class="text-right">
					{#if creditorsWithoutWallet.length > 0}
						<p class="mb-1 text-xs text-amber-700">
							Warning: creditors without e-wallet may only be paid cash.
						</p>
					{/if}
					<button
						onclick={handleFinalize}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
					>
						Lock & settle
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
				totalCentavos={totalCentavos}
				onSetRole={handleSetRole}
				onSetContribution={handleSetContribution}
			/>
		</section>

		{#if preview.data}
			<SettlementPreview
				transactions={preview.data.transactions}
				residueCentavos={preview.data.residueCentavos}
				unclaimedItems={preview.data.unclaimedItems}
				fundingGap={preview.data.fundingGap}
				profiles={state.profiles}
				status={state.room.status}
			/>
		{/if}
	</div>
{/if}
