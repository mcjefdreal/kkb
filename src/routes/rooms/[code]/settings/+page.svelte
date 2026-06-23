<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQuery, useMutation } from 'convex-svelte';
	import { useAuth } from '$lib/auth/client.svelte.js';
	import { api } from '$lib/convex-api.js';
	import MemberList from '$lib/components/MemberList.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';

	let { data } = $props();
	const auth = useAuth();

	const roomState = useQuery(api.queries.getRoomState, () => ({ roomId: data.roomId }));
	const setContribution = useMutation(api.rooms.setContribution);
	const setRole = useMutation(api.rooms.setMemberRole);
	const reopen = useMutation(api.rooms.reopenRoom);
	const deleteRoom = useMutation(api.rooms.deleteRoom);
	const leave = useMutation(api.rooms.leaveRoom);

	const currentUserId = $derived(auth.user?.id ?? '');
	const isCreator = $derived(
		!!roomState.data && roomState.data.room.createdBy === currentUserId
	);
	const totalCentavos = $derived(
		roomState.data?.items.reduce((sum, i) => sum + i.priceCentavos * i.qty, 0) ?? 0
	);
	const canReopen = $derived(
		isCreator && roomState.data?.room.status === 'settling' &&
		!roomState.data.settlements.some((p) => p.status === 'paid')
	);

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

	async function handleReopen() {
		try {
			await reopen({ roomId: data.roomId });
			toasts.add('Room reopened', 'success');
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Reopen failed', 'error');
		}
	}

	async function handleDelete() {
		if (!confirm('Delete this room permanently?')) return;
		try {
			await deleteRoom({ roomId: data.roomId });
			toasts.add('Room deleted', 'success');
			goto('/dashboard');
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Delete failed', 'error');
		}
	}

	async function handleLeave() {
		if (!confirm('Leave this room? Your claims and contribution will be removed.')) return;
		try {
			await leave({ roomId: data.roomId });
			toasts.add('Left room', 'success');
			goto('/dashboard');
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Leave failed', 'error');
		}
	}
</script>

{#if roomState.isLoading || !roomState.data}
	<Spinner />
{:else}
	{@const state = roomState.data}
	<h1 class="mb-6 text-2xl font-bold">{state.room.name} settings</h1>

	<section class="mb-8">
		<h2 class="mb-2 font-semibold">Members & contributions</h2>
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

	<section class="mb-8">
		<h2 class="mb-2 font-semibold">E-wallets</h2>
		<div class="space-y-2">
			{#each state.members as member (member._id)}
				{@const profile = state.profiles[member.userId]}
				<div class="flex justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm">
					<span>{profile?.displayName ?? 'Unknown'}</span>
					<span class="text-slate-500">
						GCash: {profile?.gcashNumber ?? '—'} · Maya: {profile?.mayaNumber ?? '—'}
					</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="space-y-3">
		{#if canReopen}
			<button
				onclick={handleReopen}
				class="w-full rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
			>
				Reopen room
			</button>
		{/if}
		{#if isCreator}
			<button
				onclick={handleDelete}
				class="w-full rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
			>
				Delete room
			</button>
		{:else}
			<button
				onclick={handleLeave}
				class="w-full rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
			>
				Leave room
			</button>
		{/if}
	</section>
{/if}
