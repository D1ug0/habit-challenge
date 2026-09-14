import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import type { ApiErrorData } from '#shared/types/api'

export function apiError(statusCode: number, code: string, message: string): never {
  throw createError({
    statusCode,
    message,
    data: { code, message } satisfies ApiErrorData,
  })
}

export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body: unknown = await readBody(event)
  const result = schema.safeParse(body ?? {})

  if (!result.success) {
    const issues = Object.fromEntries(
      result.error.issues.map(issue => [issue.path.join('.') || 'body', issue.message]),
    )
    throw createError({
      statusCode: 422,
      message: 'Некорректные данные',
      data: {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте заполненные поля',
        issues,
      } satisfies ApiErrorData,
    })
  }

  return result.data
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505'
}

export function asConfigurationError(error: unknown): never {
  if (error instanceof ZodError) {
    apiError(500, 'SERVER_CONFIGURATION_ERROR', 'Сервер не настроен. Проверьте переменные окружения.')
  }

  throw error
}
