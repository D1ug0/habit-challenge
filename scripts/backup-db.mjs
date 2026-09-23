import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { finished } from 'node:stream/promises'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const connection = new URL(databaseUrl)
if (!['postgres:', 'postgresql:'].includes(connection.protocol)) {
  throw new Error('DATABASE_URL must use the postgres or postgresql protocol')
}

const databaseName = decodeURIComponent(connection.pathname.replace(/^\//, ''))
const databaseUser = decodeURIComponent(connection.username)
const databasePassword = decodeURIComponent(connection.password)
const sslMode = connection.searchParams.get('sslmode')
const backupDirectory = resolve(process.cwd(), process.env.BACKUP_DIR ?? 'backups')
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backupPath = resolve(backupDirectory, `habit-challenge-${timestamp}.dump`)
const partialPath = `${backupPath}.partial`
const backupS3Uri = process.env.BACKUP_S3_URI
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? '7')
if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 365) {
  throw new Error('BACKUP_RETENTION_DAYS must be an integer from 0 to 365')
}
if (backupS3Uri && !/^s3:\/\/[a-z0-9][a-z0-9.-]{2,62}(?:\/[a-zA-Z0-9/_.-]*)?$/.test(backupS3Uri)) {
  throw new Error('BACKUP_S3_URI must be an s3://bucket/prefix URI')
}

await mkdir(backupDirectory, { recursive: true })

function waitForExit(childProcess) {
  return new Promise((resolveExitCode, reject) => {
    childProcess.once('error', reject)
    childProcess.once('exit', (code) => resolveExitCode(code))
  })
}

async function runInstalledPgDump() {
  const pgDump = spawn(
    process.env.PG_DUMP_PATH ?? 'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--host',
      connection.hostname,
      '--port',
      connection.port || '5432',
      '--username',
      databaseUser,
      '--file',
      partialPath,
      databaseName,
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: databasePassword,
        ...(sslMode ? { PGSSLMODE: sslMode } : {}),
      },
      stdio: 'inherit',
    },
  )

  return waitForExit(pgDump)
}

async function runDockerPgDump() {
  const localDockerDatabase =
    ['localhost', '127.0.0.1'].includes(connection.hostname) && connection.port === '5433'
  if (!localDockerDatabase) {
    throw new Error(
      'pg_dump is not installed. Install PostgreSQL client tools or set PG_DUMP_PATH.',
    )
  }

  const output = createWriteStream(partialPath, { flags: 'wx' })
  const pgDump = spawn(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-e',
      `PGPASSWORD=${databasePassword}`,
      'postgres',
      'pg_dump',
      '--format=custom',
      '--no-owner',
      '--username',
      databaseUser,
      '--dbname',
      databaseName,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  )
  pgDump.stdout.pipe(output)

  const exitCode = await waitForExit(pgDump)
  await finished(output)
  return exitCode
}

let exitCode
try {
  try {
    exitCode = await runInstalledPgDump()
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    exitCode = await runDockerPgDump()
  }

  if (exitCode !== 0) {
    throw new Error(`pg_dump exited with code ${exitCode}`)
  }

  await rename(partialPath, backupPath)
  if (backupS3Uri) {
    const target = `${backupS3Uri.replace(/\/$/, '')}/${backupPath.split(/[\\/]/).at(-1)}`
    const upload = spawn('aws', ['s3', 'cp', backupPath, target, '--no-progress'], {
      stdio: 'inherit',
    })
    const uploadExitCode = await waitForExit(upload)
    if (uploadExitCode !== 0) throw new Error(`aws s3 cp exited with code ${uploadExitCode}`)
    console.info(`Database backup uploaded: ${target}`)
  }
  if (retentionDays > 0) {
    for (const filename of await readdir(backupDirectory)) {
      if (!/^habit-challenge-\d{4}-\d{2}-\d{2}T[\d-]+Z\.dump$/.test(filename)) continue
      const candidate = resolve(backupDirectory, filename)
      if ((await stat(candidate)).mtimeMs < Date.now() - retentionDays * 86_400_000) {
        await rm(candidate)
      }
    }
  }
} catch (error) {
  await rm(partialPath, { force: true })
  throw error
}

console.info(`Database backup created: ${backupPath}`)
