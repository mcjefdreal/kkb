<script lang="ts">
	import { toasts } from '$lib/stores/toast.js';
</script>

<div class="fixed right-4 top-4 z-50 flex flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			class="max-w-xs rounded-lg px-4 py-3 text-sm shadow-lg"
			class:bg-red-600={toast.type === 'error'}
			class:bg-green-600={toast.type === 'success'}
			class:bg-blue-600={toast.type === 'info'}
			class:text-white={true}
		>
			{toast.message}
		</div>
	{/each}
</div>
