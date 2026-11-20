import assert from 'node:assert/strict';
import test from 'node:test';
import { createFakeBackendClient, splitIntoChunks } from '../src/main/fake-backend.ts';

test('splits text into word chunks that join back exactly', () => {
  const text = 'Merhaba  dünya,\n\n- madde';
  assert.deepEqual(splitIntoChunks(text), ['Merhaba  ', 'dünya,\n\n', '- ', 'madde']);
  assert.equal(splitIntoChunks(text).join(''), text);
});

test('assigns sequential message ids across sends and streams per client', async () => {
  const client = createFakeBackendClient({ wordDelayMs: 0 });
  const first = await client.sendMessage({ message: 'Bir', chat_id: null });
  assert.equal(first.ok, true);
  let streamed = '';
  const second = await client.streamMessage(
    { message: 'İki', chat_id: first.data.chat_id },
    (delta) => { streamed += delta; },
  );
  assert.equal(second.ok, true);
  const third = await client.sendMessage({ message: 'Üç', chat_id: first.data.chat_id });
  const otherClient = createFakeBackendClient({ wordDelayMs: 0 });
  const reset = await otherClient.sendMessage({ message: 'Yeni', chat_id: null });
  assert.equal(third.ok, true);
  assert.equal(reset.ok, true);

  assert.equal(first.data.message_id, 'demo-message-1');
  assert.equal(second.data.message_id, 'demo-message-2');
  assert.equal(third.data.message_id, 'demo-message-3');
  assert.equal(reset.data.message_id, 'demo-message-1');
  assert.equal(streamed, second.data.message);
  assert.match(second.data.message, /Demo yanıtı/);
});

test('mentions documents uploaded for the chat and keeps the chat id', async () => {
  const client = createFakeBackendClient({ wordDelayMs: 0 });
  const upload = await client.uploadDocument({ document_name: 'notlar.md', content: 'içerik' });

  const first = await client.sendMessage({ message: 'Özetle', chat_id: null, document_ids: [upload.data.document_id] });
  const second = await client.sendMessage({ message: 'Devam', chat_id: first.data.chat_id });

  assert.match(first.data.message, /`notlar\.md`/);
  assert.match(second.data.message, /`notlar\.md`/);
  assert.equal(second.data.chat_id, first.data.chat_id);
});

test('keeps settings in memory and reports tokens as configured', async () => {
  const client = createFakeBackendClient({ wordDelayMs: 0 });

  const updated = await client.updateSettings({ provider: 'openai', model: 'gpt-5' });

  assert.deepEqual(updated, { ok: true, data: { provider: 'openai', model: 'gpt-5' } });
  assert.deepEqual(await client.getSettings(), updated);
  assert.deepEqual(await client.saveToken({ provider: 'openai', apiKey: 'k' }), {
    ok: true,
    data: { provider: 'openai', configured: true },
  });
});
