import type { Provider } from '../../../shared/deski-api.js';

export interface ProviderOption {
  id: Provider;
  name: string;
  /** Suggested models; users may still type any model name. */
  models: readonly string[];
}

export const PROVIDERS: readonly ProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-5', 'gpt-5-mini'],
  },
];

export const DEFAULT_PROVIDER: Provider = 'anthropic';

export function providerOption(id: Provider): ProviderOption {
  const option = PROVIDERS.find((provider) => provider.id === id);
  if (!option) throw new Error(`Unknown provider: ${id}`);
  return option;
}

/** Keeps the current model when it belongs to the provider, else suggests the first. */
export function modelForProvider(id: Provider, currentModel: string): string {
  const { models } = providerOption(id);
  return models.includes(currentModel) ? currentModel : (models[0] ?? '');
}
