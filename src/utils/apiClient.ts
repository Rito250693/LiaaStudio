let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  if (method !== 'GET' && method !== 'HEAD' && currentCsrfToken) {
    headers.set('X-CSRF-Token', currentCsrfToken);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
