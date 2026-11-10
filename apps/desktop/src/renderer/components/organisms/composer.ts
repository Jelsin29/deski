import { h } from '../../dom.ts';
import {
  ACCEPTED_FILE_TYPES,
  readAttachment,
  type PendingAttachment,
} from '../../features/documents/attachments.ts';
import { tr } from '../../i18n/tr.ts';
import { iconButton } from '../atoms/icon-button.ts';
import { attachmentChip } from '../molecules/attachment-chip.ts';
import { notice } from '../molecules/notice.ts';

const MAX_INPUT_HEIGHT_PX = 200;
const MAX_MESSAGE_LENGTH = 10_000;

export interface ComposerHandlers {
  onSubmit(text: string, attachments: PendingAttachment[]): void;
}

export interface ComposerView {
  element: HTMLElement;
  setBusy(busy: boolean): void;
  addFiles(files: Iterable<File>): Promise<void>;
  focus(): void;
}

export function createComposer(handlers: ComposerHandlers): ComposerView {
  let attachments: PendingAttachment[] = [];
  let busy = false;

  const textarea = h('textarea', {
    className: 'composer__input',
    attrs: {
      rows: '1',
      maxlength: String(MAX_MESSAGE_LENGTH),
      placeholder: tr.chat.placeholder,
      'aria-label': tr.chat.placeholder,
    },
    on: { input: onInput, keydown: onKeydown },
  });
  const fileInput = h('input', {
    className: 'visually-hidden',
    attrs: { type: 'file', multiple: true, accept: ACCEPTED_FILE_TYPES, tabindex: '-1', 'aria-hidden': 'true' },
    on: { change: onFilesChosen },
  });
  const chips = h('div', { className: 'composer__attachments', attrs: { hidden: true } });
  const problems = h('div', { className: 'composer__problems' });
  const sendButton = iconButton({ icon: 'arrowUp', label: tr.chat.send, type: 'submit', className: 'composer__send' });

  const element = h(
    'form',
    { className: 'composer', on: { submit: (event) => { event.preventDefault(); submit(); } } },
    [
      problems,
      h('div', { className: 'composer__box' }, [
        chips,
        textarea,
        h('div', { className: 'composer__actions' }, [
          iconButton({ icon: 'paperclip', label: tr.chat.attach, onClick: () => fileInput.click() }),
          fileInput,
          sendButton,
        ]),
      ]),
      h('p', { className: 'composer__hint', text: tr.chat.disclaimer }),
    ],
  );

  function canSend(): boolean {
    return !busy && textarea.value.trim().length > 0;
  }

  function syncSendButton(): void {
    sendButton.disabled = !canSend();
  }

  function resizeInput(): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }

  function onInput(): void {
    resizeInput();
    syncSendButton();
  }

  function onKeydown(event: KeyboardEvent): void {
    // isComposing keeps Enter usable for IME candidate selection.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function onFilesChosen(): void {
    void addFiles(fileInput.files ?? []);
    fileInput.value = ''; // Allows choosing the same file again.
  }

  function showProblems(messages: string[]): void {
    problems.replaceChildren(...messages.map((message) => notice('error', message)));
  }

  function renderAttachments(): void {
    chips.hidden = attachments.length === 0;
    chips.replaceChildren(
      ...attachments.map((attachment) =>
        attachmentChip({
          name: attachment.name,
          size: attachment.size,
          onRemove: () => {
            attachments = attachments.filter(({ id }) => id !== attachment.id);
            renderAttachments();
          },
        }),
      ),
    );
  }

  function submit(): void {
    if (!canSend()) return;
    handlers.onSubmit(textarea.value.trim(), attachments);
    attachments = [];
    textarea.value = '';
    renderAttachments();
    showProblems([]);
    resizeInput();
    syncSendButton();
  }

  async function addFiles(files: Iterable<File>): Promise<void> {
    const results = await Promise.all(
      Array.from(files, (file) => readAttachment(file, crypto.randomUUID())),
    );
    const messages: string[] = [];
    for (const result of results) {
      if (result.ok) attachments = [...attachments, result.attachment];
      else messages.push(tr.attachments[result.problem](result.name));
    }
    renderAttachments();
    showProblems(messages);
  }

  function setBusy(value: boolean): void {
    busy = value;
    syncSendButton();
  }

  syncSendButton();
  return { element, setBusy, addFiles, focus: () => textarea.focus() };
}
