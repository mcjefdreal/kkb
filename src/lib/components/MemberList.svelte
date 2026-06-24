<script lang="ts">
	import type { RoomMember, Contribution, Profile } from '$lib/types.js';
	import { formatPHP } from '$lib/money.js';
	import ContributionInput from './ContributionInput.svelte';
	import HelpButton from './HelpButton.svelte';

	interface Props {
		members: RoomMember[];
		contributions: Contribution[];
		profiles: Record<string, Pick<Profile, 'displayName'>>;
		currentUserId: string;
		isCreator: boolean;
		onSetRole: (targetUserId: string, role: 'member' | 'contributor') => void;
		onSetContribution: (amountCentavos: number) => void;
	}

	let {
		members,
		contributions,
		profiles,
		currentUserId,
		isCreator,
		onSetRole,
		onSetContribution
	}: Props = $props();

	function contributionFor(userId: string) {
		return contributions.find((c) => c.userId === userId)?.amountCentavos ?? 0;
	}
</script>

<div class="space-y-2">
	{#each members as member (member._id)}
		<div class="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
			<div>
				<p class="font-medium">{profiles[member.userId]?.displayName ?? 'Unknown'}</p>
				<p class="text-xs text-slate-500">{member.role}</p>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm">{formatPHP(contributionFor(member.userId))}</span>
				{#if member.userId === currentUserId && (member.role === 'contributor' || isCreator)}
					<ContributionInput
						amountCentavos={contributionFor(member.userId)}
						onChange={onSetContribution}
					/>
				{/if}
				{#if isCreator && member.userId !== currentUserId}
					<button
						type="button"
						onclick={() => onSetRole(member.userId, member.role === 'member' ? 'contributor' : 'member')}
						class="text-xs text-slate-600 underline"
					>
						{member.role === 'member' ? 'Make contributor' : 'Demote to member'}
					</button>
					<HelpButton
						id="role-{member.userId}"
						label="Help about member roles"
						text="Contributors can set their own contribution amount. Members can only claim items."
					/>
				{/if}
			</div>
		</div>
	{/each}
</div>
