import { getDateInTimeZone } from '#shared/domain/time'

export function useRefreshOnResume(
  refresh: () => Promise<void>,
  timeZones: () => readonly string[],
): void {
  let dayKey = ''
  let intervalId: ReturnType<typeof setInterval> | null = null
  let refreshPending = false

  function getDayKey(): string {
    return [...new Set(timeZones())]
      .sort()
      .map((timeZone) => `${timeZone}:${getDateInTimeZone(timeZone)}`)
      .join('|')
  }

  async function runRefresh(): Promise<void> {
    if (refreshPending) return
    refreshPending = true
    try {
      await refresh()
      dayKey = getDayKey()
    } finally {
      refreshPending = false
    }
  }

  function refreshIfVisible(): void {
    if (document.visibilityState === 'visible') void runRefresh()
  }

  function refreshOnDayChange(): void {
    const nextDayKey = getDayKey()
    if (nextDayKey !== dayKey) void runRefresh()
  }

  onMounted(() => {
    dayKey = getDayKey()
    document.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', refreshIfVisible)
    intervalId = setInterval(refreshOnDayChange, 30_000)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', refreshIfVisible)
    window.removeEventListener('focus', refreshIfVisible)
    if (intervalId) clearInterval(intervalId)
  })
}
