import type {
  ChatRequest,
  ChatStreamRequest,
  DocumentRequest,
  Provider,
  SettingsPatch,
  TokenUpdate,
} from '../shared/deski-api.js';

// Mirrors the bounds in docs/api-contracts.md. The renderer is untrusted from
// the main process' point of view, so every IPC payload is checked here before
// it is forwarded to the backend.
export const LIMITS = {
  message: 10_000,
  id: 128,
  documentName: 255,
  documentContent: 1_000_000,
  model: 128,
  apiKey: 4_096,
} as const;

const PROVIDERS: readonly Provider[] = ['openai', 'anthropic'];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && value.trim().length > 0;
}

function isProvider(value: unknown): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

export function parseChatRequest(input: unknown): ChatRequest | null {
  if (!isRecord(input) || !isText(input.message, LIMITS.message)) return null;
  const chatId = input.chat_id ?? null;
  if (chatId !== null && !isText(chatId, LIMITS.id)) return null;
  return { message: input.message, chat_id: chatId };
}

export function parseChatStreamRequest(input: unknown): ChatStreamRequest | null {
  if (!isRecord(input) || !isText(input.streamId, LIMITS.id)) return null;
  const chat = parseChatRequest(input.chat);
  return chat === null ? null : { streamId: input.streamId, chat };
}

export function parseDocumentRequest(input: unknown): DocumentRequest | null {
  if (!isRecord(input)) return null;
  const { document_name: name, content } = input;
  if (!isText(name, LIMITS.documentName) || !isText(content, LIMITS.documentContent)) return null;
  return { document_name: name, content };
}

export function parseSettingsPatch(input: unknown): SettingsPatch | null {
  if (!isRecord(input)) return null;
  const patch: SettingsPatch = {};
  if (input.provider !== undefined) {
    if (!isProvider(input.provider)) return null;
    patch.provider = input.provider;
  }
  if (input.model !== undefined) {
    if (!isText(input.model, LIMITS.model)) return null;
    patch.model = input.model;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function parseTokenUpdate(input: unknown): TokenUpdate | null {
  if (!isRecord(input) || !isProvider(input.provider) || !isText(input.apiKey, LIMITS.apiKey)) {
    return null;
  }
  return { provider: input.provider, apiKey: input.apiKey };
}
