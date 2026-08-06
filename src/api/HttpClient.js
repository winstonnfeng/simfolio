/** Thin fetch wrapper: base URL, bearer token, and a single error shape. */

export class ApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export class HttpClient {
  constructor({ baseUrl, getToken = () => null, fetchImpl = fetch.bind(globalThis), timeoutMs = 8000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const token = this.getToken();
    try {
      const response = await this.fetch(this.baseUrl + path, {
        method,
        signal: controller.signal,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const error = payload?.error ?? {};
        throw new ApiError(error.message ?? `Request failed (${response.status})`, {
          code: error.code ?? 'API_ERROR',
          status: response.status,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Could not reach the server', { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
    }
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  put(path, body) {
    return this.request('PUT', path, body);
  }
}
