import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatStore } from '../src/renderer/features/chat/chat-store.ts';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

const chat = { id: 'c1', remoteId: null, title: 'Selam', createdAt: 'x', updatedAt: 'x', messages: [] };

test('round-trips saved chats', () => {
  const store = createChatStore(memoryStorage());
  store.save([chat]);
  assert.deepEqual(store.load(), [chat]);
});

test('starts empty when storage is missing or corrupted', () => {
  assert.deepEqual(createChatStore(memoryStorage()).load(), []);
  assert.deepEqual(createChatStore(memoryStorage({ 'deski.chats.v1': '{oops' })).load(), []);
});

test('skips entries that are not chats', () => {
  const storage = memoryStorage({ 'deski.chats.v1': JSON.stringify([chat, { id: 3 }, null]) });
  assert.deepEqual(createChatStore(storage).load(), [chat]);
});
