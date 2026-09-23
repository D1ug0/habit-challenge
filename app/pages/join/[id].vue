<script setup lang="ts">
import JoinChallengeView from '~/features/join-challenge/ui/JoinChallengeView.vue'

const route = useRoute()
const challengeId = computed(() => String(route.params.id))
const inviteToken = computed(() =>
  typeof route.query.inviteToken === 'string' ? route.query.inviteToken : undefined,
)
</script>

<template>
  <JoinChallengeView :challenge-id="challengeId" :invite-token="inviteToken" />
</template>
