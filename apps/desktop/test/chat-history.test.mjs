import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendMessage,
  createChat,
  deriveTitle,
  groupByRecency,
  withRemoteId,
} from '../src/renderer/features/chat/chat-history.ts';

const chatAt = (id, updatedAt) => ({ ...createChat(id, id, new Date(updatedAt)), updatedAt });

test('derives a single-line, length-limited title from the first message', () => {
  assert.equal(deriveTitle('  Merhaba   dünya \nikinci satır'), 'Merhaba dünya');
  const title = deriveTitle('a'.repeat(80));
  assert.equal(title.length, 48);
  assert.ok(title.endsWith('…'));
});

test('appending a message returns a new chat and updates its timestamp', () => {
  const chat = createChat('c1', 'Selam', new Date('2026-11-10T10:00:00Z'));
  const message = { id: 'm1', role: 'user', content: 'Selam', createdAt: '2026-11-10T10:05:00.000Z', attachments: [] };

  const updated = appendMessage(chat, message);

  assert.equal(chat.messages.length, 0);
  assert.deepEqual(updated.messages, [message]);
  assert.equal(updated.updatedAt, message.createdAt);
  assert.equal(withRemoteId(updated, 'r1').remoteId, 'r1');
});

test('groups chats by recency, newest first, without empty groups', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const chats = [
    chatAt('older', new Date(2026, 9, 1).toISOString()),
    chatAt('today-early', new Date(2026, 10, 10, 9, 0).toISOString()),
    chatAt('today-late', new Date(2026, 10, 10, 14, 0).toISOString()),
    chatAt('yesterday', new Date(2026, 10, 9, 20, 0).toISOString()),
  ];

  const groups = groupByRecency(chats, now).map(({ group, chats: grouped }) => [group, grouped.map(({ id }) => id)]);

  assert.deepEqual(groups, [
    ['today', ['today-late', 'today-early']],
    ['yesterday', ['yesterday']],
    ['older', ['older']],
  ]);
});
