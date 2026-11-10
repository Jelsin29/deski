import { h } from '../../dom.ts';
import type { ChatMessage } from '../../features/chat/chat-history.ts';
import { renderMarkdown } from '../../features/chat/markdown.ts';
import { tr } from '../../i18n/tr.ts';
import { brandMark } from '../atoms/brand-mark.ts';
import { icon } from '../atoms/icon.ts';
import { attachmentChip } from './attachment-chip.ts';

function userMessage(message: ChatMessage): HTMLElement {
  const attachments = message.attachments.length > 0 &&
    h('div', { className: 'message__attachments' }, message.attachments.map((file) => attachmentChip(file)));

  return h('article', { className: 'message message--user' }, [
    attachments,
    h('div', { className: 'message__bubble', text: message.content }),
  ]);
}

function assistantArticle(body: HTMLElement): HTMLElement {
  return h('article', { className: 'message message--assistant' }, [
    h('div', { className: 'message__avatar' }, [brandMark(28)]),
    body,
  ]);
}

function assistantMessage(message: ChatMessage): HTMLElement {
  const body = h('div', { className: 'message__body' });
  if (message.failed) {
    body.classList.add('message__body--error');
    body.append(icon('alert', 16), h('span', { text: message.content }));
  } else {
    // Safe: renderMarkdown escapes all text before adding markup.
    body.innerHTML = renderMarkdown(message.content);
  }
  return assistantArticle(body);
}

export function messageItem(message: ChatMessage): HTMLElement {
  return message.role === 'user' ? userMessage(message) : assistantMessage(message);
}

export interface StreamingMessage {
  element: HTMLElement;
  setText(text: string): void;
}

function typingIndicator(): HTMLElement {
  return h('div', { className: 'typing', attrs: { role: 'status', 'aria-label': tr.chat.thinking } }, [
    h('span'),
    h('span'),
    h('span'),
  ]);
}

/** A reply that is still arriving: typing dots first, then the partial text. */
export function streamingMessage(): StreamingMessage {
  const body = h('div', { className: 'message__body is-streaming' });
  const element = assistantArticle(body);
  element.setAttribute('aria-busy', 'true');

  function setText(text: string): void {
    if (text.length === 0) body.replaceChildren(typingIndicator());
    else body.innerHTML = renderMarkdown(text);
  }

  setText('');
  return { element, setText };
}
