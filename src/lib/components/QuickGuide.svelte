<script lang="ts">
	import { useAuth } from '$lib/auth/client.svelte.js';

	const auth = useAuth();

	const ctaCreate = $derived(auth.isAuthenticated ? '/rooms/new' : '/login');
	const ctaJoin = $derived(auth.isAuthenticated ? '/join' : '/login');
</script>

<section class="mt-12">
	<h2 class="mb-6 text-center text-xl font-semibold text-slate-700">How it works</h2>
	<div class="grid gap-6 md:grid-cols-2">
		<div class="rounded-lg border border-slate-200 p-6">
			<h3 class="mb-3 text-lg font-bold text-slate-900">Create a room</h3>
			<ol class="mb-5 list-inside list-decimal space-y-2 text-sm text-slate-600">
				<li>Set up a room with a name and the bill items</li>
				<li>Add your own contribution</li>
				<li>Share the 8‑character code with friends</li>
			</ol>
			<a
				href={ctaCreate}
				class="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
			>
				Create a room
			</a>
		</div>

		<div class="rounded-lg border border-slate-200 p-6">
			<h3 class="mb-3 text-lg font-bold text-slate-900">Join a room</h3>
			<ol class="mb-5 list-inside list-decimal space-y-2 text-sm text-slate-600">
				<li>Get the 8‑character code from the creator</li>
				<li>Enter it on the Join page</li>
				<li>Add your contribution to the room</li>
			</ol>
			<a
				href={ctaJoin}
				class="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
			>
				Join a room
			</a>
		</div>
	</div>
</section>
