<script lang="ts">
	import { useQuery, useMutation } from 'convex-svelte';
	import { useAuth } from '$lib/auth/client.svelte.js';
	import { api } from '$lib/convex-api.js';
	import { roomStatusLabel } from '$lib/labels.js';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';
	import type { Id } from '../../convex/_generated/dataModel.js';

	const rooms = useQuery(api.queries.listMyRooms, () => ({}));
	const deleteRoom = useMutation(api.rooms.deleteRoom);
	const auth = useAuth();

	const currentUserId = $derived(auth.user?.id ?? '');

	async function handleDelete(roomId: Id<'rooms'>, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (!confirm('Delete this room permanently?')) return;
		try {
			await deleteRoom({ roomId });
			toasts.add('Room deleted', 'success');
		} catch (err) {
			toasts.add(err instanceof Error ? err.message : 'Delete failed', 'error');
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Your rooms</h1>
	<a href="/rooms/new" class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
		New room
	</a>
</div>

{#if rooms.isLoading}
	<Spinner />
{:else if rooms.data && rooms.data.length > 0}
	<ErrorBoundary error={rooms.error}>
		<div class="space-y-3">
			{#each rooms.data as room (room._id)}
				<div
					class="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
				>
					<a
						href="/rooms/{room.code}"
						class="flex min-w-0 flex-1 items-center justify-between"
					>
						<div>
							<p class="font-medium">{room.name}</p>
							<p class="text-xs text-slate-500">
								{room.code} · {roomStatusLabel[room.status]}
							</p>
						</div>
						<span class="text-xs uppercase text-slate-400">{room.role}</span>
					</a>
					{#if room.createdBy === currentUserId}
						<button
							onclick={(e) => handleDelete(room._id, e)}
							class="ml-4 rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
						>
							Delete
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</ErrorBoundary>
{:else}
	<ErrorBoundary error={rooms.error}>
		<p class="text-slate-500">No rooms yet. Create one to get started.</p>
	</ErrorBoundary>
{/if}
