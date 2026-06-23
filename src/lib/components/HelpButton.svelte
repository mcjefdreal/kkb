<script lang="ts">
	interface Props {
		label: string;
		text: string;
	}

	let { label, text }: Props = $props();

	let open = $state(false);
	const tooltipId = `tooltip-${crypto.randomUUID()}`;

	function openTooltip() {
		open = true;
	}

	function closeTooltip() {
		open = false;
	}
</script>

<span class="relative inline-flex items-center">
	<button
		type="button"
		aria-label={label}
		aria-describedby={tooltipId}
		class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
		onmouseenter={openTooltip}
		onmouseleave={closeTooltip}
		onfocus={openTooltip}
		onblur={closeTooltip}
		onclick={openTooltip}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				closeTooltip();
			}
		}}
	>
		?
	</button>
	<span
		id={tooltipId}
		role="tooltip"
		aria-hidden={!open}
		class="pointer-events-none absolute bottom-full left-1/2 mb-1 w-48 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-center text-xs text-white shadow-lg transition-opacity {open
			? 'opacity-100'
			: 'opacity-0'}"
	>
		{text}
	</span>
</span>
