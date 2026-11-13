import assert from 'node:assert/strict';
import test from 'node:test';
import { createFakeBackendClient, splitIntoChunks } from '../src/main/fake-backend.ts';

test('splits text into word chunks that join back exactly', () => {
  const text = 'Merhaba  dünya,\n\n- madde';
  assert.deepEqual(splitIntoChunks(text), ['Merhaba  ', 'dünya,\n\n', '- ', 'madde']);
  assert.equal(splitIntoChunks(text).join(''), text);
});

test('streams a demo reply whose chunks add up to the final message', async () => {
  const client = createFakeBackendClient({ wordDelayMs: 0 });
  let streamed = '';

  const result = await client.streamMessage({ message: 'Selam', chat_id: null }, (delta) => { streamed += delta; });

  assert.equal(result.ok, true);
  assert.equal(streamed, result.data.message);
  assert.match(result.data.message, /Demo yanıtı/);
});

test('mentions documents uploaded for the chat and keeps the chat id', async () => {
  const client = createFakeBackendClient({ wordDelayMs: 0 });
  await client.uploadDocument({ document_name: 'notlar.md', content: 'içerik' });

  const first = await client.sendMessage({ message: 'Özetle', chat_id: null });
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
