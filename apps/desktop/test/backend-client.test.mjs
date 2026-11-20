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

test('reads history and token metadata and accepts an empty delete response', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.method]);
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json([]);
  };
  const client = createBackendClient('http://backend.test', fetchImpl);

  assert.deepEqual(await client.listChats(), { ok: true, data: [] });
  assert.deepEqual(await client.getChatMessages('id/1'), { ok: true, data: [] });
  assert.deepEqual(await client.getTokenStatus(), { ok: true, data: [] });
  assert.deepEqual(await client.deleteChat('id/1'), { ok: true, data: undefined });
  assert.deepEqual(calls, [
    ['http://backend.test/api/v1/chats', 'GET'],
    ['http://backend.test/api/v1/chats/id%2F1/messages', 'GET'],
    ['http://backend.test/api/v1/tokens', 'GET'],
    ['http://backend.test/api/v1/chats/id%2F1', 'DELETE'],
  ]);
});

test('reads SSE frames across network chunks and returns the assembled reply', async () => {
  const frames = 'event: start\ndata: {"chat_id":"c1"}\n\nevent: delta\ndata: {"text":"Tam "}\n\nevent: delta\ndata: {"text":"yanıt"}\n\nevent: done\ndata: {"message_id":"m1"}\n\n';
  const chunks = [frames.slice(0, 37), frames.slice(37, 75), frames.slice(75)];
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'http://backend.test/api/v1/chat/stream');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Accept, 'text/event-stream');
    assert.equal(init.body, JSON.stringify({ message: 'Selam', chat_id: null, document_ids: ['d1'] }));
    return new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
  };
  const client = createBackendClient('http://backend.test', fetchImpl);
  const deltas = [];

  const result = await client.streamMessage({ message: 'Selam', chat_id: null, document_ids: ['d1'] }, (delta) => deltas.push(delta));

  assert.deepEqual(result, { ok: true, data: { chat_id: 'c1', message: 'Tam yanıt' } });
  assert.deepEqual(deltas, ['Tam ', 'yanıt']);
});

test('reports a stream error without accepting a partial reply', async () => {
  const fetchImpl = async () => new Response('event: start\ndata: {"chat_id":"c1"}\n\nevent: delta\ndata: {"text":"Yarım"}\n\nevent: error\ndata: {"detail":"Chat stream failed"}\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  });
  const deltas = [];
  const result = await createBackendClient('http://backend.test', fetchImpl)
    .streamMessage({ message: 'Selam' }, (delta) => deltas.push(delta));

  assert.deepEqual(deltas, ['Yarım']);
  assert.deepEqual(result, { ok: false, error: { kind: 'failed', status: null, detail: 'Chat stream failed' } });
});

test('rejects a stream that ends before done', async () => {
  const fetchImpl = async () => new Response('event: start\ndata: {"chat_id":"c1"}\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  });
  const result = await createBackendClient('http://backend.test', fetchImpl)
    .streamMessage({ message: 'Selam' }, () => {});

  assert.deepEqual(result, { ok: false, error: { kind: 'failed', status: null, detail: null } });
});

test('classifies a streaming endpoint 503 as unavailable', async () => {
  const { fetchImpl } = fakeFetch(503, { detail: 'Chat service unavailable' });
  const result = await createBackendClient('http://backend.test', fetchImpl)
    .streamMessage({ message: 'Selam' }, () => {});

  assert.deepEqual(result, { ok: false, error: { kind: 'unavailable', status: 503, detail: 'Chat service unavailable' } });
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
