import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackendClient, toApiError } from '../src/main/backend-client.ts';

function fakeFetch(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

test('sends chat requests as JSON to the versioned API', async () => {
  const { calls, fetchImpl } = fakeFetch(200, { chat_id: 'c1', message: 'Merhaba' });
  const client = createBackendClient('http://backend.test', fetchImpl);

  const result = await client.sendMessage({ message: 'Selam', chat_id: null });

  assert.deepEqual(result, { ok: true, data: { chat_id: 'c1', message: 'Merhaba' } });
  assert.equal(calls[0].url, 'http://backend.test/api/v1/chat');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ message: 'Selam', chat_id: null }));
});

test('saves tokens under the provider path with the backend field name', async () => {
  const { calls, fetchImpl } = fakeFetch(200, { provider: 'openai', configured: true });
  const client = createBackendClient('http://backend.test', fetchImpl);

  await client.saveToken({ provider: 'openai', apiKey: 'secret' });

  assert.equal(calls[0].url, 'http://backend.test/api/v1/tokens/openai');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.body, JSON.stringify({ api_key: 'secret' }));
});

test('streams a non-streaming backend reply as a single chunk', async () => {
  const { fetchImpl } = fakeFetch(200, { chat_id: 'c1', message: 'Tam yanıt' });
  const client = createBackendClient('http://backend.test', fetchImpl);
  const deltas = [];

  const result = await client.streamMessage({ message: 'Selam', chat_id: null }, (delta) => deltas.push(delta));

  assert.equal(result.ok, true);
  assert.deepEqual(deltas, ['Tam yanıt']);
});

test('reports unwired services as unavailable with their detail', async () => {
  const { fetchImpl } = fakeFetch(503, { detail: 'Chat service unavailable' });
  const client = createBackendClient('http://backend.test', fetchImpl);

  const result = await client.sendMessage({ message: 'Selam', chat_id: null });

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'unavailable', status: 503, detail: 'Chat service unavailable' },
  });
});

test('reports network failures as offline', async () => {
  const client = createBackendClient('http://backend.test', async () => {
    throw new TypeError('fetch failed');
  });

  const result = await client.health();

  assert.deepEqual(result, { ok: false, error: { kind: 'offline', status: null, detail: null } });
});

test('classifies error statuses and ignores non-string validation details', () => {
  assert.deepEqual(toApiError(422, { detail: [{ msg: 'bad' }] }), { kind: 'invalid', status: 422, detail: null });
  assert.deepEqual(toApiError(500, null), { kind: 'failed', status: 500, detail: null });
});
