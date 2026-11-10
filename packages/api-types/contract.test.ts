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
  '/api/v1/health' | '/api/v1/chat' | '/api/v1/documents' |
  '/api/v1/settings' | '/api/v1/tokens/{provider}'>>;
