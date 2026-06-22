<script lang="ts">
	interface Props {
		error?: Error | string | null;
		children?: import('svelte').Snippet;
	}

	let { error, children }: Props = $props();
</script>

{#if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
		<p class="font-semibold">Something went wrong</p>
		<p class="text-sm">{error instanceof Error ? error.message : error}</p>
	</div>
{:else}
	{@render children?.()}
{/if}
