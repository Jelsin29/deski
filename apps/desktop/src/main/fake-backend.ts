import type { ApiResult, ChatResponse, Settings } from '../shared/deski-api.js';
import type { BackendClient } from './backend-client.ts';

// Development stand-in for the FastAPI services, enabled only with
// `npm run dev:fake`. It lets the UI be built and demonstrated (including
// streamed replies) before teammates wire the real services. The UI labels
// this mode as a demo, so its answers are never mistaken for real ones.

export interface FakeBackendOptions {
  /** Pause between streamed words; 0 in tests. */
  wordDelayMs?: number;
}

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });

const wait = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** Splits text into words while keeping the whitespace, so chunks join back exactly. */
export function splitIntoChunks(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

export function composeDemoReply(message: string, documentNames: readonly string[]): string {
  const quoted = message.length > 120 ? `${message.slice(0, 119)}…` : message;
  const documents = documentNames.length > 0
    ? `Bu sohbete eklenen belgeler: ${documentNames.map((name) => `\`${name}\``).join(', ')}.`
    : 'Bu sohbete henüz belge eklenmedi.';

  return [
    '**Demo yanıtı:** Bu metin, arayüzü denemek için sahte API tarafından akış (stream) olarak üretildi.',
    `Mesajınız: “${quoted}”`,
    documents,
    'Gerçek backend bağlandığında yanıtlar seçtiğiniz sağlayıcıdan gelecek:\n- Anthropic (Claude modelleri)\n- OpenAI (GPT modelleri)',
  ].join('\n\n');
}

export function createFakeBackendClient({ wordDelayMs = 35 }: FakeBackendOptions = {}): BackendClient {
  let settings: Settings = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
  let documentCount = 0;
  let chatCount = 0;
  const documentsByChat = new Map<string, string[]>();
  // Documents are uploaded before their message, so they wait here until the chat is known.
  let unassignedDocuments: string[] = [];

  function reply(message: string, chatId: string | null | undefined): ChatResponse {
    const id = chatId ?? `demo-chat-${++chatCount}`;
    const documents = [...(documentsByChat.get(id) ?? []), ...unassignedDocuments];
    documentsByChat.set(id, documents);
    unassignedDocuments = [];
    return { chat_id: id, message: composeDemoReply(message, documents) };
  }

  return {
    health: async () => ok({ status: 'ok' }),
    sendMessage: async ({ message, chat_id }) => ok(reply(message, chat_id)),
    async streamMessage({ message, chat_id }, onDelta) {
      const response = reply(message, chat_id);
      for (const chunk of splitIntoChunks(response.message)) {
        await wait(wordDelayMs);
        onDelta(chunk);
      }
      return ok(response);
    },
    async uploadDocument({ document_name }) {
      unassignedDocuments = [...unassignedDocuments, document_name];
      return ok({ document_id: `demo-document-${++documentCount}`, document_name });
    },
    getSettings: async () => ok(settings),
    async updateSettings(patch) {
      settings = { ...settings, ...patch };
      return ok(settings);
    },
    saveToken: async ({ provider }) => ok({ provider, configured: true }),
  };
}
