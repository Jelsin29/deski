import type { ApiResult, ChatResponse, DeskiApi } from '../../../shared/deski-api.js';
import type { PendingAttachment } from '../documents/attachments.ts';

export interface OutgoingMessage {
  chatId: string | null;
  text: string;
  attachments: readonly PendingAttachment[];
}

type ChatApi = Pick<DeskiApi, 'streamMessage' | 'uploadDocument'>;

/**
 * Uploads attachments first so they can be retrieved for the answer, then
 * streams the reply through `onDelta`. Stops at the first failure and reports it.
 */
export async function sendMessage(
  api: ChatApi,
  outgoing: OutgoingMessage,
  onDelta: (delta: string) => void,
): Promise<ApiResult<ChatResponse>> {
  for (const attachment of outgoing.attachments) {
    const upload = await api.uploadDocument({
      document_name: attachment.name,
      content: attachment.content,
    });
    if (!upload.ok) return upload;
  }
  return api.streamMessage({ message: outgoing.text, chat_id: outgoing.chatId }, onDelta);
}
