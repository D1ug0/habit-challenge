import { spawn } from 'node:child_process'

if (!process.env.BACKUP_S3_URI) throw new Error('BACKUP_S3_URI is required for scheduled backups')
const backupHour = Number(process.env.BACKUP_HOUR_UTC ?? '2')
if (!Number.isInteger(backupHour) || backupHour < 0 || backupHour > 23)
  throw new Error('BACKUP_HOUR_UTC must be 0-23')

function nextRun() {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(backupHour, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function schedule() {
  const runAt = nextRun()
  console.info(JSON.stringify({ type: 'backup_scheduled', runAt: runAt.toISOString() }))
  setTimeout(() => {
    const child = spawn(process.execPath, ['scripts/backup-db.mjs'], {
      stdio: 'inherit',
      env: process.env,
    })
    let settled = false
    child.once('exit', (code) => {
      if (settled) return
      settled = true
      if (code !== 0) console.error(JSON.stringify({ type: 'backup_failed', code }))
      schedule()
    })
    child.once('error', (error) => {
      if (settled) return
      settled = true
      console.error(JSON.stringify({ type: 'backup_failed', message: error.message }))
      schedule()
    })
  }, runAt.valueOf() - Date.now())
}

schedule()
