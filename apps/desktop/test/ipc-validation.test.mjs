import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIMITS,
  parseChatRequest,
  parseChatStreamRequest,
  parseDocumentRequest,
  parseSettingsPatch,
  parseTokenUpdate,
} from '../src/main/ipc-validation.ts';

test('accepts chat requests with or without a chat id', () => {
  assert.deepEqual(parseChatRequest({ message: 'Selam' }), { message: 'Selam', chat_id: null });
  assert.deepEqual(parseChatRequest({ message: 'Selam', chat_id: 'c1' }), { message: 'Selam', chat_id: 'c1' });
});

test('rejects blank, oversized or malformed chat requests', () => {
  assert.equal(parseChatRequest({ message: '   ' }), null);
  assert.equal(parseChatRequest({ message: 'x'.repeat(LIMITS.message + 1) }), null);
  assert.equal(parseChatRequest({ message: 'Selam', chat_id: 42 }), null);
  assert.equal(parseChatRequest('Selam'), null);
});

test('requires a stream id around a valid chat request', () => {
  assert.deepEqual(parseChatStreamRequest({ streamId: 's1', chat: { message: 'Selam' } }), {
    streamId: 's1',
    chat: { message: 'Selam', chat_id: null },
  });
  assert.equal(parseChatStreamRequest({ chat: { message: 'Selam' } }), null);
  assert.equal(parseChatStreamRequest({ streamId: 's1', chat: { message: '' } }), null);
});

test('drops unknown fields so they never reach the backend', () => {
  assert.deepEqual(parseDocumentRequest({ document_name: 'a.txt', content: 'metin', path: '/etc' }), {
    document_name: 'a.txt',
    content: 'metin',
  });
});

test('requires at least one valid settings field', () => {
  assert.deepEqual(parseSettingsPatch({ provider: 'anthropic' }), { provider: 'anthropic' });
  assert.deepEqual(parseSettingsPatch({ model: 'gpt-5' }), { model: 'gpt-5' });
  assert.equal(parseSettingsPatch({}), null);
  assert.equal(parseSettingsPatch({ provider: 'claude' }), null);
  assert.equal(parseSettingsPatch({ provider: 'openai', model: '' }), null);
});

test('validates token updates by provider and key', () => {
  assert.deepEqual(parseTokenUpdate({ provider: 'openai', apiKey: 'k' }), { provider: 'openai', apiKey: 'k' });
  assert.equal(parseTokenUpdate({ provider: 'gemini', apiKey: 'k' }), null);
  assert.equal(parseTokenUpdate({ provider: 'openai', apiKey: ' ' }), null);
});
