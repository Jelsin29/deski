import type { BackendMode } from '../../shared/deski-api.js';
import { iconButton } from '../components/atoms/icon-button.ts';
import { createComposer } from '../components/organisms/composer.ts';
import { createMessageList } from '../components/organisms/message-list.ts';
import { h } from '../dom.ts';
import type { Chat } from '../features/chat/chat-history.ts';
import type { PendingAttachment } from '../features/documents/attachments.ts';
import { tr } from '../i18n/tr.ts';

export interface ChatPageHandlers {
  onSubmit(text: string, attachments: PendingAttachment[]): void;
  onToggleSidebar(): void;
}

export interface ChatPageState {
  chat: Chat | null;
  /** Text of the reply arriving for this chat, or null when none is. */
  streaming: string | null;
  /** Any request is running; only one message is sent at a time. */
  busy: boolean;
}

export interface ChatPageView {
  element: HTMLElement;
  render(state: ChatPageState): void;
  updateStream(text: string): void;
  focusComposer(): void;
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

export function createChatPage(handlers: ChatPageHandlers, backendMode: BackendMode): ChatPageView {
  const title = h('h1', { className: 'page-header__title' });
  const messageList = createMessageList();
  const composer = createComposer({ onSubmit: handlers.onSubmit });
  const dropOverlay = h('div', { className: 'drop-overlay', text: tr.chat.dropFiles, attrs: { hidden: true } });

  const element = h(
    'section',
    {
      className: 'page chat-page',
      on: {
        dragover: (event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          dropOverlay.hidden = false;
        },
        dragleave: (event) => {
          if (!element.contains(event.relatedTarget as Node | null)) dropOverlay.hidden = true;
        },
        drop: (event) => {
          event.preventDefault();
          dropOverlay.hidden = true;
          if (event.dataTransfer) void composer.addFiles(event.dataTransfer.files);
        },
      },
    },
    [
      h('header', { className: 'page-header titlebar-drag' }, [
        iconButton({ icon: 'sidebar', label: tr.sidebar.toggle, onClick: handlers.onToggleSidebar }),
        title,
        backendMode === 'fake' &&
          h('span', { className: 'demo-badge', text: tr.chat.demoBadge, attrs: { title: tr.chat.demoHint } }),
      ]),
      messageList.element,
      composer.element,
      dropOverlay,
    ],
  );

  function render({ chat, streaming, busy }: ChatPageState): void {
    title.textContent = chat?.title ?? tr.sidebar.newChat;
    messageList.render(chat, streaming);
    composer.setBusy(busy);
  }

  return {
    element,
    render,
    updateStream: (text) => messageList.updateStream(text),
    focusComposer: () => composer.focus(),
  };
}
