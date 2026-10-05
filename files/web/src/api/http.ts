/**
 * Minimal JSON client for the backend. The ONLY place in the web app that calls fetch.
 * Requests go to /api/* (proxied to the API server by Vite in development).
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server');
  }

  if (!response.ok) {
    // The server replies with { statusCode, error, message } on errors.
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(response.status, data?.message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<undefined>('DELETE', path),
};

/** A readable message for any thrown value (for stores and UI). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
