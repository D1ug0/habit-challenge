import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  if (process.env.NODE_ENV !== 'production') return

  const startedAt = performance.now()
  const requestId = getHeader(event, 'x-request-id')?.slice(0, 128) || randomUUID()
  setResponseHeader(event, 'x-request-id', requestId)

  event.node.res.once('finish', () => {
    console.info(
      JSON.stringify({
        type: 'http_request',
        requestId,
        method: event.method,
        path: getRequestURL(event).pathname,
        status: event.node.res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )
  })
})
