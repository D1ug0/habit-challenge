interface ErrorShape {
  data?: {
    data?: {
      message?: unknown
      issues?: unknown
    }
    message?: unknown
  }
  message?: unknown
}

export function getApiErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'Что-то пошло не так. Попробуйте ещё раз.'
  }

  const value = error as ErrorShape
  const nestedMessage = value.data?.data?.message
  if (typeof nestedMessage === 'string') {
    return nestedMessage
  }
  if (typeof value.data?.message === 'string') {
    return value.data.message
  }
  if (typeof value.message === 'string' && !value.message.includes('[GET]') && !value.message.includes('[POST]')) {
    return value.message
  }
  return 'Не удалось связаться с сервером. Попробуйте ещё раз.'
}
