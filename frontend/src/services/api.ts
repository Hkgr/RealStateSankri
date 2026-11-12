const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type Params = Record<string, string | number | null | undefined>

export async function apiGet<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  }
  const qs = query.toString()

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${qs ? `?${qs}` : ''}`, { headers: { Accept: 'application/json' }, signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('تعذّر الاتصال بالخادم. تحقق من أن الواجهة الخلفية تعمل.', 0)
  }

  if (!response.ok) {
    let message = 'حدث خطأ غير متوقع أثناء جلب البيانات.'
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(message, response.status)
  }
  return ((await response.json()) as { data: T }).data
}
