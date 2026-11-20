import { h } from '../../dom.ts';
import type { Chat } from '../../features/chat/chat-history.ts';
import { tr } from '../../i18n/tr.ts';
import { brandMark } from '../atoms/brand-mark.ts';
import { messageItem, streamingMessage, type StreamingMessage } from '../molecules/message-item.ts';

// Follow new text only while the reader is already near the bottom.
const STICK_TO_BOTTOM_PX = 80;

export interface MessageListView {
  element: HTMLElement;
  /** `streamingText` is null when no reply is arriving for this chat. */
  render(chat: Chat | null, streamingText: string | null): void;
  /** Updates only the arriving reply instead of rebuilding the list. */
  updateStream(text: string): void;
}

function emptyState(): HTMLElement {
  return h('div', { className: 'empty-state' }, [
    brandMark(56),
    h('h2', { className: 'empty-state__title', text: tr.chat.greeting }),
    h('p', { className: 'empty-state__hint', text: tr.chat.greetingHint }),
  ]);
}

export function createMessageList(): MessageListView {
  const content = h('div', { className: 'message-list__content' });
  const element = h('div', { className: 'message-list', attrs: { 'aria-live': 'polite' } }, [content]);
  let streaming: StreamingMessage | null = null;

  const isNearBottom = (): boolean =>
    element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_PX;

  const scrollToBottom = (): void => {
    element.scrollTop = element.scrollHeight;
  };

  function render(chat: Chat | null, streamingText: string | null): void {
    const messages = chat?.messages ?? [];
    const isEmpty = messages.length === 0 && streamingText === null;

    streaming = streamingText === null ? null : streamingMessage();
    streaming?.setText(streamingText ?? '');

    element.classList.toggle('is-empty', isEmpty);
    content.replaceChildren(
      ...(isEmpty ? [emptyState()] : messages.map(messageItem)),
      ...(streaming ? [streaming.element] : []),
    );
    scrollToBottom();
  }

  function updateStream(text: string): void {
    if (!streaming) return;
    const follow = isNearBottom();
    streaming.setText(text);
    if (follow) scrollToBottom();
  }

  return { element, render, updateStream };
}
