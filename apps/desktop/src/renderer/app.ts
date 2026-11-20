import type { DeskiApi } from '../shared/deski-api.js';
import { errorMessage } from './api/error-message.ts';
import { createSidebar } from './components/organisms/sidebar.ts';
import { h } from './dom.ts';
import {
  appendMessage,
  createChat,
  mergeRemoteChats,
  withRemoteMessages,
  withRemoteId,
  type Chat,
  type ChatMessage,
} from './features/chat/chat-history.ts';
import { createChatStore } from './features/chat/chat-store.ts';
import { sendMessage } from './features/chat/send-message.ts';
import type { PendingAttachment } from './features/documents/attachments.ts';
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ThemePreference,
} from './features/settings/theme.ts';
import { tr } from './i18n/tr.ts';
import { createChatPage } from './pages/chat-page.ts';
import { createSettingsPage } from './pages/settings-page.ts';

type View = 'chat' | 'settings';

/** Owns application state and connects the pages to the bridge API. */
export function createApp(root: HTMLElement, api: DeskiApi, storage: Storage): void {
  const chatStore = createChatStore(storage);
  let chats: Chat[] = chatStore.load();
  let activeChatId: string | null = null;
  let pendingChatId: string | null = null;
  let streamingText = '';
  let view: View = 'chat';

  // Theme
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let themePreference = loadThemePreference(storage);
  const applyTheme = (): void => {
    document.documentElement.dataset.theme = resolveTheme(themePreference, systemDark.matches);
  };
  systemDark.addEventListener('change', applyTheme);
  document.documentElement.dataset.platform = api.platform;
  applyTheme();

  // Views
  const sidebar = createSidebar({
    onNewChat: startNewChat,
    onSelectChat: (chatId) => showChat(chatId),
    onDeleteChat: (chatId) => void deleteChat(chatId),
    onOpenSettings: openSettings,
  });
  const chatPage = createChatPage(
    {
      onSubmit: (text, attachments) => void submitMessage(text, attachments),
      onToggleSidebar: () => shell.classList.toggle('is-sidebar-collapsed'),
    },
    api.backendMode,
  );
  const settingsPage = createSettingsPage(api, {
    theme: themePreference,
    onBack: () => showChat(activeChatId),
    onThemeChange: changeTheme,
  });
  const shell = h('div', { className: 'app' }, [
    sidebar.element,
    h('main', { className: 'app__main' }, [chatPage.element, settingsPage.element]),
  ]);
  root.replaceChildren(shell);
  render();
  if (api.backendMode === 'live') void loadRemoteChats();

  function findChat(chatId: string | null): Chat | null {
    return chats.find((chat) => chat.id === chatId) ?? null;
  }

  function render(): void {
    sidebar.update({
      chats,
      activeChatId: view === 'chat' ? activeChatId : null,
      settingsOpen: view === 'settings',
    });
    chatPage.element.hidden = view !== 'chat';
    settingsPage.element.hidden = view !== 'settings';
    chatPage.render({
      chat: findChat(activeChatId),
      streaming: pendingChatId !== null && pendingChatId === activeChatId ? streamingText : null,
      busy: pendingChatId !== null,
    });
  }

  function saveChat(chat: Chat): void {
    chats = [chat, ...chats.filter(({ id }) => id !== chat.id)];
    chatStore.save(chats);
  }

  function showChat(chatId: string | null): void {
    activeChatId = chatId;
    view = 'chat';
    render();
    chatPage.focusComposer();
    const chat = findChat(chatId);
    if (chat?.remoteId && pendingChatId !== chat.id) void loadRemoteMessages(chat);
  }

  async function loadRemoteChats(): Promise<void> {
    const result = await api.listChats();
    if (!result.ok) return;
    chats = mergeRemoteChats(chats, result.data);
    chatStore.save(chats);
    render();
  }

  async function loadRemoteMessages(chat: Chat): Promise<void> {
    if (!chat.remoteId) return;
    const result = await api.getChatMessages(chat.remoteId);
    if (!result.ok || !findChat(chat.id) || pendingChatId === chat.id) return;
    saveChat(withRemoteMessages(findChat(chat.id)!, result.data));
    render();
  }

  function startNewChat(): void {
    showChat(null);
  }

  function openSettings(): void {
    view = 'settings';
    render();
    void settingsPage.open();
  }

  function changeTheme(theme: ThemePreference): void {
    themePreference = theme;
    saveThemePreference(storage, theme);
    applyTheme();
  }

  async function deleteChat(chatId: string): Promise<void> {
    const chat = findChat(chatId);
    if (!chat || !window.confirm(tr.sidebar.confirmDelete(chat.title))) return;
    if (chat.remoteId && api.backendMode === 'live') {
      const result = await api.deleteChat(chat.remoteId);
      if (!result.ok && result.error.kind !== 'offline' && result.error.kind !== 'unavailable') {
        window.alert(errorMessage(result.error));
        return;
      }
    }
    chats = chats.filter(({ id }) => id !== chatId);
    chatStore.save(chats);
    if (activeChatId === chatId) activeChatId = null;
    render();
  }

  async function submitMessage(text: string, attachments: PendingAttachment[]): Promise<void> {
    const sentAt = new Date();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: sentAt.toISOString(),
      attachments: attachments.map(({ name, size }) => ({ name, size })),
    };
    const chat = appendMessage(findChat(activeChatId) ?? createChat(crypto.randomUUID(), text, sentAt), userMessage);
    saveChat(chat);
    activeChatId = chat.id;
    pendingChatId = chat.id;
    streamingText = '';
    render();

    const result = await sendMessage(api, { chatId: chat.remoteId, text, attachments }, (delta) => {
      streamingText += delta;
      if (view === 'chat' && activeChatId === chat.id) chatPage.updateStream(streamingText);
    });
    pendingChatId = null;

    // The chat may have been deleted while waiting for the reply.
    const latest = findChat(chat.id);
    if (latest) {
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.ok ? result.data.message : errorMessage(result.error),
        createdAt: new Date().toISOString(),
        attachments: [],
        ...(result.ok ? {} : { failed: true }),
      };
      const answered = appendMessage(latest, reply);
      saveChat(result.ok ? withRemoteId(answered, result.data.chat_id) : answered);
    }
    render();
  }
}
