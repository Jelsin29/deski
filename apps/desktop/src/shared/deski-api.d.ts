// Contract between the Electron main process, the preload bridge and the
// renderer. Types only: every process imports it, none of them bundles it.
import type { components } from '@deski/api-types';

type Schemas = components['schemas'];

export type Provider = Schemas['Provider'];
export type ChatRequest = Schemas['ChatRequest'];
export type ChatResponse = Schemas['ChatResponse'];
export type DocumentRequest = Schemas['DocumentRequest'];
export type DocumentResponse = Schemas['DocumentResponse'];
export type Settings = Schemas['SettingsResponse'];
export type SettingsPatch = Schemas['SettingsPatch'];
export type TokenResponse = Schemas['TokenResponse'];

export interface HealthStatus {
  status: string;
}

/** Asks the main process to stream a reply; chunks carry the same stream id. */
export interface ChatStreamRequest {
  streamId: string;
  chat: ChatRequest;
}

export interface ChatStreamChunk {
  streamId: string;
  delta: string;
}

/** `fake` means the development stand-in API answers instead of FastAPI. */
export type BackendMode = 'live' | 'fake';

export interface TokenUpdate {
  provider: Provider;
  apiKey: string;
}

/**
 * Why a backend call failed, in terms the UI can act on:
 * - offline: the backend could not be reached at all
 * - unavailable: the backend answered 503 (service not wired yet)
 * - invalid: the request was rejected by validation
 * - failed: any other error response
 */
export type ApiErrorKind = 'offline' | 'unavailable' | 'invalid' | 'failed';

export interface ApiError {
  kind: ApiErrorKind;
  status: number | null;
  detail: string | null;
}

/** IPC cannot carry rich exceptions, so every call resolves to a result. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Request and response payload for every IPC channel. */
export interface IpcContract {
  'backend:health': { request: undefined; response: ApiResult<HealthStatus> };
  'chat:stream': { request: ChatStreamRequest; response: ApiResult<ChatResponse> };
  'documents:upload': { request: DocumentRequest; response: ApiResult<DocumentResponse> };
  'settings:get': { request: undefined; response: ApiResult<Settings> };
  'settings:update': { request: SettingsPatch; response: ApiResult<Settings> };
  'tokens:save': { request: TokenUpdate; response: ApiResult<TokenResponse> };
}

export type IpcChannel = keyof IpcContract;

/** Main → renderer event carrying one streamed piece of a reply. */
export type ChatChunkEvent = 'chat:chunk';

/** The narrow API that the preload script exposes as `window.deski`. */
export interface DeskiApi {
  readonly platform: string;
  readonly backendMode: BackendMode;
  checkHealth(): Promise<ApiResult<HealthStatus>>;
  /** Calls `onDelta` for every piece of the reply, then resolves with the full reply. */
  streamMessage(request: ChatRequest, onDelta: (delta: string) => void): Promise<ApiResult<ChatResponse>>;
  uploadDocument(request: DocumentRequest): Promise<ApiResult<DocumentResponse>>;
  getSettings(): Promise<ApiResult<Settings>>;
  updateSettings(patch: SettingsPatch): Promise<ApiResult<Settings>>;
  saveToken(update: TokenUpdate): Promise<ApiResult<TokenResponse>>;
}
