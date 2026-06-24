<script lang="ts">
	import { toCentavos, formatPHP } from '$lib/money.js';
	import HelpButton from './HelpButton.svelte';

	interface Props {
		amountCentavos: number;
		onChange: (amountCentavos: number) => void;
	}

	let { amountCentavos, onChange }: Props = $props();

	let value = $state(formatPHP(amountCentavos));
	let error = $state<string | null>(null);

	function submit() {
		try {
			const centavos = toCentavos(value);
			error = null;
			onChange(centavos);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid amount';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}
</script>

<div class="flex items-center gap-2">
	<input
		bind:value
		onblur={submit}
		onkeydown={handleKeydown}
		placeholder="0.00"
		class="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
	/>
	<HelpButton
		label="Help about contribution limit"
		text="You can contribute more than the total. Any extra is returned as change after settlement."
	/>
	{#if error}
		<span class="text-xs text-red-600">{error}</span>
	{/if}
</div>
