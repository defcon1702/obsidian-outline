/**
 * Custom HTTP instance for the orval-generated Outline API client.
 *
 * Uses a pluggable transport so the same generated code works with
 * native `fetch` (Node / CLI) **and** Obsidian's `requestUrl`.
 *
 * Call `configure()` once before any API call.
 */

export interface TransportResponse {
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}

export type Transport = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<TransportResponse>;

const fetchTransport: Transport = async (url, init) => {
  const res = await fetch(url, init);
  return {
    status: res.status,
    headers: res.headers,
    json: () => res.json(),
  };
};

let _baseUrl = '';
let _apiKey = '';
let _transport: Transport = fetchTransport;

export function configure(opts: { baseUrl: string; apiKey: string; transport?: Transport }) {
  _baseUrl = opts.baseUrl.replace(/\/$/, '');
  _apiKey = opts.apiKey;
  if (opts.transport) _transport = opts.transport;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;

export const customInstance = async <T>(url: string, init: RequestInit): Promise<T> => {
  const fullUrl = `${_baseUrl}/api${url}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${_apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, init.headers);
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await _transport(fullUrl, {
      method: (init.method ?? 'POST') as string,
      headers,
      body: init.body as string | undefined,
    });

    if (res.status === 429) {
      const raw = parseInt(res.headers.get('retry-after') ?? '5', 10);
      const retryAfter = Math.min(isNaN(raw) ? 5 : raw, 60);
      await sleep(retryAfter * 1000);
      continue;
    }

    const data = await res.json().catch(() => ({}));

    if (res.status >= 400) {
      const detail =
        data && typeof data === 'object' && 'message' in data
          ? (data as { message: string }).message
          : '';
      console.error(`[Outline API] ${res.status} on ${url}${detail ? `: ${detail}` : ''}`);
    }

    return { data, status: res.status, headers: res.headers } as T;
  }

  throw new Error(`[Outline API] Max retries exceeded on ${url}`);
};

export default customInstance;

export type ErrorType<T> = T;
export type BodyType<T> = T;
