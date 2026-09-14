<script setup lang="ts">
import JoinChallengeView from '~/features/join-challenge/ui/JoinChallengeView.vue'

const route = useRoute()
const challengeId = computed(() => String(route.params.id))
</script>

<template>
  <JoinChallengeView :challenge-id="challengeId" />
</template>
