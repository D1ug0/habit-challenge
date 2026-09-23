<template>
  <NuxtRouteAnnouncer />
  <div class="app-shell">
    <header class="app-header">
      <NuxtLink to="/" class="brand" aria-label="Habit Challenge — на главную">
        <span class="brand-mark">H</span>
        <span>habit</span>
      </NuxtLink>
      <span class="header-note">каждый день имеет значение</span>
      <NuxtLink to="/profile" class="profile-link">Профиль</NuxtLink>
    </header>
    <main class="page-shell">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.profile-link {
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 750;
  text-decoration: none;
}
</style>
