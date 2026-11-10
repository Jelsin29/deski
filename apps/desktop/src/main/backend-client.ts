import type {
  ApiError,
  ApiResult,
  ChatRequest,
  ChatResponse,
  DocumentRequest,
  DocumentResponse,
  HealthStatus,
  Settings,
  SettingsPatch,
  TokenResponse,
  TokenUpdate,
} from '../shared/deski-api.js';

export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';

// Model replies can be slow; a hung backend must still release the UI.
const REQUEST_TIMEOUT_MS = 120_000;

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';

export interface BackendClient {
  health(): Promise<ApiResult<HealthStatus>>;
  sendMessage(request: ChatRequest): Promise<ApiResult<ChatResponse>>;
  streamMessage(request: ChatRequest, onDelta: (delta: string) => void): Promise<ApiResult<ChatResponse>>;
  uploadDocument(request: DocumentRequest): Promise<ApiResult<DocumentResponse>>;
  getSettings(): Promise<ApiResult<Settings>>;
  updateSettings(patch: SettingsPatch): Promise<ApiResult<Settings>>;
  saveToken(update: TokenUpdate): Promise<ApiResult<TokenResponse>>;
}

/** Talks to the local FastAPI backend; `fetchImpl` is injectable for tests. */
export function createBackendClient(
  baseUrl: string = DEFAULT_BACKEND_URL,
  fetchImpl: typeof fetch = fetch,
): BackendClient {
  async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/api/v1${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, error: { kind: 'offline', status: null, detail: null } };
    }

    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: payload as T };
    return { ok: false, error: toApiError(response.status, payload) };
  }

  const sendMessage = (chat: ChatRequest): Promise<ApiResult<ChatResponse>> =>
    request('POST', '/chat', chat);

  return {
    health: () => request('GET', '/health'),
    sendMessage,
    // The backend has no streaming endpoint yet: deliver the reply as one chunk.
    async streamMessage(chat, onDelta) {
      const result = await sendMessage(chat);
      if (result.ok) onDelta(result.data.message);
      return result;
    },
    uploadDocument: (document) => request('POST', '/documents', document),
    getSettings: () => request('GET', '/settings'),
    updateSettings: (patch) => request('PATCH', '/settings', patch),
    saveToken: ({ provider, apiKey }) =>
      request('PUT', `/tokens/${encodeURIComponent(provider)}`, { api_key: apiKey }),
  };
}

export function toApiError(status: number, payload: unknown): ApiError {
  const detail = readDetail(payload);
  if (status === 503) return { kind: 'unavailable', status, detail };
  if (status === 400 || status === 422) return { kind: 'invalid', status, detail };
  return { kind: 'failed', status, detail };
}

// FastAPI uses a string detail for handled errors and a list for validation.
function readDetail(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) return null;
  return typeof payload.detail === 'string' ? payload.detail : null;
}
