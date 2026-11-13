// Pure chat model operations. Every function returns new objects so the UI
// can compare and persist snapshots safely.

export type Role = 'user' | 'assistant';

export interface AttachmentInfo {
  name: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  attachments: AttachmentInfo[];
  /** Set when the message describes a failed request instead of a reply. */
  failed?: boolean;
}

export interface Chat {
  id: string;
  /** Identifier assigned by the backend after the first reply. */
  remoteId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export type RecencyGroup = 'today' | 'yesterday' | 'previous7Days' | 'older';

export interface ChatGroup {
  group: RecencyGroup;
  chats: Chat[];
}

const TITLE_MAX_LENGTH = 48;
const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveTitle(text: string): string {
  const firstLine = text.trim().split('\n')[0] ?? '';
  const singleSpaced = firstLine.replace(/\s+/g, ' ').trim();
  return singleSpaced.length > TITLE_MAX_LENGTH
    ? `${singleSpaced.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : singleSpaced;
}

export function createChat(id: string, firstMessage: string, now: Date): Chat {
  const timestamp = now.toISOString();
  return {
    id,
    remoteId: null,
    title: deriveTitle(firstMessage),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
}

export function appendMessage(chat: Chat, message: ChatMessage): Chat {
  return { ...chat, updatedAt: message.createdAt, messages: [...chat.messages, message] };
}

export function withRemoteId(chat: Chat, remoteId: string): Chat {
  return { ...chat, remoteId };
}

export function sortByRecent(chats: readonly Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function recencyOf(updatedAt: string, startOfToday: number): RecencyGroup {
  const time = Date.parse(updatedAt);
  if (time >= startOfToday) return 'today';
  if (time >= startOfToday - DAY_MS) return 'yesterday';
  if (time >= startOfToday - 7 * DAY_MS) return 'previous7Days';
  return 'older';
}

/** Groups chats like the sidebar shows them, newest first, empty groups omitted. */
export function groupByRecency(chats: readonly Chat[], now: Date): ChatGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const order: RecencyGroup[] = ['today', 'yesterday', 'previous7Days', 'older'];
  const groups = new Map<RecencyGroup, Chat[]>(order.map((group) => [group, []]));

  for (const chat of sortByRecent(chats)) {
    groups.get(recencyOf(chat.updatedAt, startOfToday))?.push(chat);
  }
  return order
    .map((group) => ({ group, chats: groups.get(group) ?? [] }))
    .filter(({ chats: grouped }) => grouped.length > 0);
}
