<script lang="ts">
	import { useQuery, useMutation } from 'convex-svelte';
	import { api } from '$lib/convex-api.js';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toasts } from '$lib/stores/toast.js';
	import { friendlyError } from '$lib/errors.js';

	const profile = useQuery(api.queries.getMyProfile, () => ({}));
	const update = useMutation(api.profiles.updateProfile);

	let displayName = $state('');
	let saving = $state(false);

	$effect(() => {
		if (profile.data) {
			displayName = profile.data.displayName ?? '';
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		saving = true;
		try {
			await update({ displayName });
			toasts.add('Profile saved', 'success');
		} catch (err) {
			toasts.add(friendlyError(err, 'Save failed'), 'error');
		} finally {
			saving = false;
		}
	}
</script>

<h1 class="mb-6 text-2xl font-bold">Profile</h1>

{#if profile.isLoading}
	<Spinner />
{:else}
	<form onsubmit={submit} class="space-y-4">
		<div>
			<label class="block text-sm font-medium" for="displayName">Display name</label>
			<input
				id="displayName"
				bind:value={displayName}
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</div>
		<button
			type="submit"
			disabled={saving}
			class="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
		>
			{saving ? 'Saving...' : 'Save'}
		</button>
	</form>
{/if}
