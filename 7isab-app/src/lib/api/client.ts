/**
 * JSON client for the 7isab server (API v1).
 *
 * Every response uses the envelope { success, message, ...data }.
 * Failures throw ApiError; network problems throw ApiError with status 0.
 */

const DEFAULT_API_URL = 'http://localhost:8000/api/v1';

const REQUEST_TIMEOUT_MS = 20_000;

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 when the server couldn't be reached. */
    readonly status: number,
    /** Field errors from validation (first message per field). */
    readonly errors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

type Envelope = { success: boolean; message: string; errors?: Record<string, string> } & Record<string, unknown>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

export async function apiRequest<T extends object>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // Without a timeout, an unreachable server can leave the UI waiting for minutes.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeout.abort());

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout.signal,
    });
  } catch {
    throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }

  let data: Envelope;
  try {
    data = (await response.json()) as Envelope;
  } catch {
    throw new ApiError(response.statusText || 'invalid_response', response.status);
  }

  if (!response.ok || data.success === false) {
    throw new ApiError(data.message ?? response.statusText, response.status, data.errors ?? {});
  }

  return data as unknown as T;
}
