const baseUrl = process.env.APP_INTERNAL_URL ?? 'http://app:3000'
const secret = process.env.REMINDER_JOB_SECRET
if (!secret || secret.length < 32)
  throw new Error('REMINDER_JOB_SECRET must have at least 32 characters')

let running = false
let lastMaintenanceHour = ''

async function runJob(path) {
  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

async function tick() {
  if (running) return
  running = true
  try {
    try {
      const result = await runJob('/api/jobs/reminders')
      console.info(JSON.stringify({ type: 'reminder_job', ...result }))
    } catch (error) {
      console.error(
        JSON.stringify({
          type: 'reminder_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
    const hour = new Date().toISOString().slice(0, 13)
    if (hour !== lastMaintenanceHour) {
      await runJob('/api/jobs/maintenance')
      lastMaintenanceHour = hour
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'job_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
  } finally {
    running = false
  }
}

await tick()
setInterval(() => {
  void tick()
}, 5 * 60_000)
