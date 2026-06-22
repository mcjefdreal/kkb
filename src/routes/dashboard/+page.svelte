<script lang="ts">
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '$lib/convex-api.js';
	import Spinner from '$lib/components/Spinner.svelte';

	const rooms = useQuery(api.queries.listMyRooms, () => ({}));
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
	<div class="space-y-3">
		{#each rooms.data as room (room._id)}
			<a
				href="/rooms/{room.code}"
				class="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
			>
				<div>
					<p class="font-medium">{room.name}</p>
					<p class="text-xs text-slate-500">{room.code} · {room.status}</p>
				</div>
				<span class="text-xs uppercase text-slate-400">{room.role}</span>
			</a>
		{/each}
	</div>
{:else}
	<p class="text-slate-500">No rooms yet. Create one to get started.</p>
{/if}
