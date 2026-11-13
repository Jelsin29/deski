import type { Chat } from './chat-history.ts';

// The backend has no chat history endpoint yet, so history is kept locally.
// Swap this store for an API-backed one once that endpoint exists.
const STORAGE_KEY = 'deski.chats.v1';

export interface ChatStore {
  load(): Chat[];
  save(chats: readonly Chat[]): void;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isChat(value: unknown): value is Chat {
  if (typeof value !== 'object' || value === null) return false;
  const chat = value as Partial<Chat>;
  return (
    typeof chat.id === 'string' &&
    typeof chat.title === 'string' &&
    typeof chat.updatedAt === 'string' &&
    Array.isArray(chat.messages)
  );
}

export function createChatStore(storage: KeyValueStorage): ChatStore {
  return {
    load() {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter(isChat) : [];
      } catch {
        // Corrupted data must not prevent the app from starting.
        return [];
      }
    },
    save(chats) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(chats));
      } catch (error) {
        console.error('Unable to save chat history:', error);
      }
    },
  };
}
