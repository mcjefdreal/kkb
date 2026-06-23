<script lang="ts">
	import { toCentavos, formatPHP } from '$lib/money.js';

	interface Props {
		amountCentavos: number;
		maxCentavos: number;
		onChange: (amountCentavos: number) => void;
	}

	let { amountCentavos, maxCentavos, onChange }: Props = $props();

	let value = $state(formatPHP(amountCentavos));
	let error = $state<string | null>(null);

	function submit() {
		try {
			const centavos = toCentavos(value);
			if (centavos > maxCentavos) {
				throw new Error(`Maximum allowed is ${formatPHP(maxCentavos)}`);
			}
			error = null;
			onChange(centavos);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid amount';
		}
	}
</script>

<div class="flex items-center gap-2">
	<input
		bind:value
		onblur={submit}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				submit();
			}
		}}
		placeholder="0.00"
		class="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
	/>
	{#if error}
		<span class="text-xs text-red-600">{error}</span>
	{/if}
</div>
