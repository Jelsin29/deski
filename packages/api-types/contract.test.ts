import type { components, paths } from './index.js';

type Assert<T extends true> = T;
type Patch = components['schemas']['SettingsPatch'];
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

// Optional non-null properties mirror public OpenAPI. The server additionally
// enforces minProperties=1; structural TS alone cannot enforce that JSON rule.
export type OptionalProvider = Assert<IsOptional<Patch, 'provider'>>;
export type OptionalModel = Assert<IsOptional<Patch, 'model'>>;
export type ProviderContract = Assert<Equal<Patch['provider'], 'openai' | 'anthropic' | undefined>>;
export type ModelContract = Assert<Equal<Patch['model'], string | undefined>>;
type JsonError<T extends { content: { 'application/json': unknown } }> =
  T['content']['application/json'];
type ErrorBody = { detail: string };
export type ChatValidationError = Assert<Equal<JsonError<
  paths['/api/v1/chat']['post']['responses'][422]>, ErrorBody>>;
export type DocumentValidationError = Assert<Equal<JsonError<
  paths['/api/v1/documents']['post']['responses'][422]>, ErrorBody>>;
export type SettingsValidationError = Assert<Equal<JsonError<
  paths['/api/v1/settings']['patch']['responses'][422]>, ErrorBody>>;
export type UnexpectedError = Assert<Equal<JsonError<
  paths['/api/v1/chat']['post']['responses'][500]>, ErrorBody>>;
export type TokenValidationError = Assert<Equal<JsonError<
  paths['/api/v1/tokens/{provider}']['put']['responses'][422]>, ErrorBody>>;

export type CurrentPaths = Assert<Equal<keyof paths,
  '/api/v1/health' | '/api/v1/chat' | '/api/v1/chat/stream' | '/api/v1/documents' |
  '/api/v1/settings' | '/api/v1/tokens/{provider}' | '/api/v1/tokens' |
  '/api/v1/chats' | '/api/v1/chats/{chat_id}' | '/api/v1/chats/{chat_id}/messages'>>;
export type DocumentIds = Assert<Equal<components['schemas']['ChatRequest']['document_ids'],
  string[] | undefined>>;
export type HistoryRoles = Assert<Equal<components['schemas']['HistoryMessage']['role'],
  'user' | 'assistant'>>;
export type TokenMetadata = Assert<Equal<JsonError<
  paths['/api/v1/tokens']['get']['responses'][200]>, components['schemas']['TokenResponse'][]>>;
type StreamResponse = paths['/api/v1/chat/stream']['post']['responses'];
export type StreamMedia = Assert<Equal<keyof StreamResponse[200]['content'], 'text/event-stream'>>;
export type StreamEvents = Assert<Equal<StreamResponse[200]['content']['text/event-stream'],
  components['schemas']['StreamStart'] | components['schemas']['StreamDelta'] |
  components['schemas']['StreamDone'] | components['schemas']['StreamError']>>;
export type StreamStartPayload = Assert<Equal<components['schemas']['StreamStart']['data'],
  { chat_id: string }>>;
export type StreamDeltaPayload = Assert<Equal<components['schemas']['StreamDelta']['data'],
  { text: string }>>;
export type StreamDonePayload = Assert<Equal<components['schemas']['StreamDone']['data'],
  { message_id: string }>>;
export type StreamErrorPayload = Assert<Equal<components['schemas']['StreamError']['data'], ErrorBody>>;
export type StreamValidation = Assert<Equal<JsonError<StreamResponse[422]>, ErrorBody>>;
export type StreamUnavailable = Assert<Equal<JsonError<StreamResponse[503]>, ErrorBody>>;
export type DeleteBody = Assert<Equal<
  paths['/api/v1/chats/{chat_id}']['delete']['responses'][204]['content'], undefined>>;
