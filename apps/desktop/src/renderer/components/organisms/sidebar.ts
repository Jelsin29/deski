import { h } from '../../dom.ts';
import { groupByRecency, type Chat } from '../../features/chat/chat-history.ts';
import { tr } from '../../i18n/tr.ts';
import { brandMark } from '../atoms/brand-mark.ts';
import { iconButton } from '../atoms/icon-button.ts';
import { icon } from '../atoms/icon.ts';

export interface SidebarHandlers {
  onNewChat(): void;
  onSelectChat(chatId: string): void;
  onDeleteChat(chatId: string): void;
  onOpenSettings(): void;
}

export interface SidebarState {
  chats: readonly Chat[];
  activeChatId: string | null;
  settingsOpen: boolean;
}

export interface SidebarView {
  element: HTMLElement;
  update(state: SidebarState): void;
}

function chatItem(chat: Chat, isActive: boolean, handlers: SidebarHandlers): HTMLElement {
  return h('div', { className: isActive ? 'chat-item is-active' : 'chat-item' }, [
    h('button', {
      className: 'chat-item__title',
      text: chat.title,
      attrs: { type: 'button', title: chat.title, 'aria-current': isActive ? 'page' : false },
      on: { click: () => handlers.onSelectChat(chat.id) },
    }),
    iconButton({
      icon: 'trash',
      label: tr.sidebar.deleteChat,
      className: 'chat-item__delete',
      onClick: () => handlers.onDeleteChat(chat.id),
    }),
  ]);
}

export function createSidebar(handlers: SidebarHandlers): SidebarView {
  const history = h('nav', { className: 'sidebar__history', attrs: { 'aria-label': tr.sidebar.newChat } });
  const settingsButton = h(
    'button',
    { className: 'nav-button', attrs: { type: 'button' }, on: { click: handlers.onOpenSettings } },
    [icon('settings'), h('span', { text: tr.sidebar.settings })],
  );

  const element = h('aside', { className: 'sidebar' }, [
    h('div', { className: 'sidebar__header titlebar-drag' }, [
      brandMark(24),
      h('span', { className: 'sidebar__wordmark', text: tr.app.name }),
    ]),
    h(
      'button',
      { className: 'button sidebar__new-chat', attrs: { type: 'button' }, on: { click: handlers.onNewChat } },
      [icon('newChat', 16), h('span', { text: tr.sidebar.newChat })],
    ),
    history,
    h('div', { className: 'sidebar__footer' }, [settingsButton]),
  ]);

  function update({ chats, activeChatId, settingsOpen }: SidebarState): void {
    const groups = groupByRecency(chats, new Date());
    history.replaceChildren(
      ...(groups.length === 0
        ? [h('p', { className: 'sidebar__empty', text: tr.sidebar.empty })]
        : groups.map(({ group, chats: grouped }) =>
            h('section', { className: 'chat-group' }, [
              h('h2', { className: 'chat-group__label', text: tr.sidebar.groups[group] }),
              ...grouped.map((chat) => chatItem(chat, chat.id === activeChatId, handlers)),
            ]),
          )),
    );
    settingsButton.classList.toggle('is-active', settingsOpen);
  }

  return { element, update };
}
