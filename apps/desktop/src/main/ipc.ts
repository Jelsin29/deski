import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type {
  ApiResult,
  ChatChunkEvent,
  ChatStreamChunk,
  IpcChannel,
  IpcContract,
} from '../shared/deski-api.js';
import type { BackendClient } from './backend-client.ts';
import {
  parseChatStreamRequest,
  parseDocumentRequest,
  parseSettingsPatch,
  parseTokenUpdate,
} from './ipc-validation.ts';

type Request<C extends IpcChannel> = IpcContract[C]['request'];
type Response<C extends IpcChannel> = IpcContract[C]['response'];

const INVALID_REQUEST: ApiResult<never> = {
  ok: false,
  error: { kind: 'invalid', status: null, detail: 'Invalid request' },
};

const noPayload = (): undefined => undefined;

// Only our own bundled page (loaded from file://) may call the bridge.
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  return url !== undefined && url.startsWith('file://');
}

function handle<C extends IpcChannel>(
  channel: C,
  parse: (input: unknown) => Request<C> | null,
  run: (request: Request<C>, event: IpcMainInvokeEvent) => Promise<Response<C>>,
): void {
  ipcMain.handle(channel, async (event, input: unknown) => {
    if (!isTrustedSender(event)) throw new Error(`Rejected IPC call on ${channel}`);
    const request = parse(input);
    return request === null ? INVALID_REQUEST : run(request, event);
  });
}

export function registerIpcHandlers(backend: BackendClient): void {
  handle('backend:health', noPayload, () => backend.health());
  handle('chat:stream', parseChatStreamRequest, ({ streamId, chat }, event) =>
    backend.streamMessage(chat, (delta) => {
      // The window may close while a reply is still streaming.
      if (event.sender.isDestroyed()) return;
      const chunk: ChatStreamChunk = { streamId, delta };
      const channel: ChatChunkEvent = 'chat:chunk';
      event.sender.send(channel, chunk);
    }),
  );
  handle('documents:upload', parseDocumentRequest, (request) => backend.uploadDocument(request));
  handle('settings:get', noPayload, () => backend.getSettings());
  handle('settings:update', parseSettingsPatch, (patch) => backend.updateSettings(patch));
  handle('tokens:save', parseTokenUpdate, (update) => backend.saveToken(update));
}
