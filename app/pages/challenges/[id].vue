<script setup lang="ts">
import ChallengeDetailsWidget from '~/widgets/challenge-progress/ui/ChallengeDetailsWidget.vue'

const route = useRoute()
const challengeId = computed(() => String(route.params.id))
</script>

<template>
  <ChallengeDetailsWidget :challenge-id="challengeId" />
</template>
