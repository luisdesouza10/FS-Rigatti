/**
 * The session lives in an httpOnly cookie that the browser sends on its own; scripts never
 * see the token. Every request also carries this header, which the API requires on writes
 * as CSRF protection (another site can't add it to a request).
 */
export const CSRF_HEADERS: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: string; details?: { field: string; message: string }[] };
  } | null;
  if (res.status === 401) unauthorizedHandler?.();
  return new ApiError(
    res.status,
    body?.error?.message ?? 'Algo deu errado. Tente novamente.',
    body?.error?.code,
    body?.error?.details,
  );
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, formData, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...CSRF_HEADERS };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
