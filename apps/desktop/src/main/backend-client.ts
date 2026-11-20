import type {
  ApiError,
  ApiResult,
  ChatRequest,
  ChatResponse,
  ChatSummary,
  HistoryMessage,
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

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface BackendClient {
  health(): Promise<ApiResult<HealthStatus>>;
  sendMessage(request: ChatRequest): Promise<ApiResult<ChatResponse>>;
  streamMessage(request: ChatRequest, onDelta: (delta: string) => void): Promise<ApiResult<ChatResponse>>;
  uploadDocument(request: DocumentRequest): Promise<ApiResult<DocumentResponse>>;
  getSettings(): Promise<ApiResult<Settings>>;
  updateSettings(patch: SettingsPatch): Promise<ApiResult<Settings>>;
  saveToken(update: TokenUpdate): Promise<ApiResult<TokenResponse>>;
  getTokenStatus(): Promise<ApiResult<TokenResponse[]>>;
  listChats(): Promise<ApiResult<ChatSummary[]>>;
  getChatMessages(chatId: string): Promise<ApiResult<HistoryMessage[]>>;
  deleteChat(chatId: string): Promise<ApiResult<void>>;
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

    if (response.status === 204) return { ok: true, data: undefined as T };
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: payload as T };
    return { ok: false, error: toApiError(response.status, payload) };
  }

  const sendMessage = (chat: ChatRequest): Promise<ApiResult<ChatResponse>> =>
    request('POST', '/chat', chat);

  async function streamMessage(
    chat: ChatRequest,
    onDelta: (delta: string) => void,
  ): Promise<ApiResult<ChatResponse>> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(chat),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, error: { kind: 'offline', status: null, detail: null } };
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      return { ok: false, error: toApiError(response.status, payload) };
    }
    if (!response.body || !response.headers.get('content-type')?.startsWith('text/event-stream')) {
      return streamFailure();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chatId: string | null = null;
    let message = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const [eventLine, dataLine] = frame.split('\n');
          if (!eventLine?.startsWith('event: ') || !dataLine?.startsWith('data: ')) return streamFailure();
          let data: unknown;
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch {
            return streamFailure();
          }
          if (typeof data !== 'object' || data === null) return streamFailure();
          if (eventLine === 'event: start' && chatId === null && 'chat_id' in data && typeof data.chat_id === 'string') {
            chatId = data.chat_id;
          } else if (eventLine === 'event: delta' && chatId !== null && 'text' in data && typeof data.text === 'string') {
            message += data.text;
            onDelta(data.text);
          } else if (eventLine === 'event: done' && chatId !== null && 'message_id' in data && typeof data.message_id === 'string') {
            return { ok: true, data: { chat_id: chatId, message_id: data.message_id, message } };
          } else if (eventLine === 'event: error' && 'detail' in data && typeof data.detail === 'string') {
            return streamFailure(data.detail);
          } else {
            return streamFailure();
          }
          boundary = buffer.indexOf('\n\n');
        }
        if (done) return streamFailure();
      }
    } catch {
      return { ok: false, error: { kind: 'offline', status: null, detail: null } };
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  return {
    health: () => request('GET', '/health'),
    sendMessage,
    streamMessage,
    uploadDocument: (document) => request('POST', '/documents', document),
    getSettings: () => request('GET', '/settings'),
    updateSettings: (patch) => request('PATCH', '/settings', patch),
    saveToken: ({ provider, apiKey }) =>
      request('PUT', `/tokens/${encodeURIComponent(provider)}`, { api_key: apiKey }),
    getTokenStatus: () => request('GET', '/tokens'),
    listChats: () => request('GET', '/chats'),
    getChatMessages: (chatId) => request('GET', `/chats/${encodeURIComponent(chatId)}/messages`),
    deleteChat: (chatId) => request('DELETE', `/chats/${encodeURIComponent(chatId)}`),
  };
}

function streamFailure(detail: string | null = null): ApiResult<never> {
  return { ok: false, error: { kind: 'failed', status: null, detail } };
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
