// Sandboxed preloads must be CommonJS, hence the .cts extension.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ChatChunkEvent,
  ChatStreamChunk,
  DeskiApi,
  IpcChannel,
  IpcContract,
} from '../shared/deski-api.js';

const CHAT_CHUNK: ChatChunkEvent = 'chat:chunk';

function invoke<C extends IpcChannel>(
  channel: C,
  request?: IpcContract[C]['request'],
): Promise<IpcContract[C]['response']> {
  return ipcRenderer.invoke(channel, request);
}

// Expose named operations only, never ipcRenderer itself.
const api: DeskiApi = {
  platform: process.platform,
  backendMode: process.argv.includes('--deski-backend-mode=fake') ? 'fake' : 'live',
  checkHealth: () => invoke('backend:health'),
  async streamMessage(chat, onDelta) {
    const streamId = crypto.randomUUID();
    const onChunk = (_event: IpcRendererEvent, chunk: ChatStreamChunk): void => {
      if (chunk.streamId === streamId) onDelta(chunk.delta);
    };
    ipcRenderer.on(CHAT_CHUNK, onChunk);
    try {
      return await invoke('chat:stream', { streamId, chat });
    } finally {
      ipcRenderer.removeListener(CHAT_CHUNK, onChunk);
    }
  },
  uploadDocument: (request) => invoke('documents:upload', request),
  getSettings: () => invoke('settings:get'),
  updateSettings: (patch) => invoke('settings:update', patch),
  saveToken: (update) => invoke('tokens:save', update),
};

contextBridge.exposeInMainWorld('deski', api);
