import assert from 'node:assert/strict';
import test from 'node:test';
import { errorMessage } from '../src/renderer/api/error-message.ts';
import { sendMessage } from '../src/renderer/features/chat/send-message.ts';

const attachment = { id: 'a1', name: 'not.txt', size: 7, content: 'Merhaba' };

function fakeApi(uploadResult = { ok: true, data: { document_id: 'd1', document_name: 'not.txt' } }) {
  const calls = [];
  return {
    calls,
    uploadDocument: async (request) => { calls.push(['upload', request]); return uploadResult; },
    streamMessage: async (request, onDelta) => {
      calls.push(['send', request]);
      onDelta('Yan');
      onDelta('ıt');
      return { ok: true, data: { chat_id: 'c1', message: 'Yanıt' } };
    },
  };
}

test('uploads attachments before streaming the reply', async () => {
  const api = fakeApi();
  const deltas = [];

  const result = await sendMessage(api, { chatId: null, text: 'Özetle', attachments: [attachment] }, (delta) => deltas.push(delta));

  assert.equal(result.ok, true);
  assert.deepEqual(deltas, ['Yan', 'ıt']);
  assert.deepEqual(api.calls, [
    ['upload', { document_name: 'not.txt', content: 'Merhaba' }],
    ['send', { message: 'Özetle', chat_id: null, document_ids: ['d1'] }],
  ]);
});

test('does not send the message when an upload fails', async () => {
  const failure = { ok: false, error: { kind: 'unavailable', status: 503, detail: 'Document service unavailable' } };
  const api = fakeApi(failure);

  const result = await sendMessage(api, { chatId: 'c1', text: 'Özetle', attachments: [attachment] }, () => {});

  assert.deepEqual(result, failure);
  assert.equal(api.calls.length, 1);
});

test('turns bridge errors into readable Turkish messages', () => {
  assert.equal(errorMessage({ kind: 'offline', status: null, detail: null }), "Backend'e ulaşılamıyor. Sunucunun çalıştığından emin olun.");
  assert.equal(
    errorMessage({ kind: 'unavailable', status: 503, detail: 'Chat service unavailable' }),
    'Bu servis henüz hazır değil. (503) Chat service unavailable',
  );
});
