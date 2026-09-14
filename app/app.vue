<template>
  <NuxtRouteAnnouncer />
  <div class="app-shell">
    <header class="app-header">
      <NuxtLink to="/" class="brand" aria-label="Habit Challenge — на главную">
        <span class="brand-mark">H</span>
        <span>habit</span>
      </NuxtLink>
      <span class="header-note">каждый день имеет значение</span>
    </header>
    <main class="page-shell">
      <NuxtPage />
    </main>
  </div>
</template>
