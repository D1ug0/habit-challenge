export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, context) => {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    if (statusCode < 500) return
    console.error(
      JSON.stringify({
        type: 'server_error',
        statusCode,
        route: context.event ? getRequestURL(context.event).pathname : undefined,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        timestamp: new Date().toISOString(),
      }),
    )
  })
})
