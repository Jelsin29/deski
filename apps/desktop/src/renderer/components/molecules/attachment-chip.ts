import { h } from '../../dom.ts';
import { formatFileSize } from '../../features/documents/attachments.ts';
import { tr } from '../../i18n/tr.ts';
import { iconButton } from '../atoms/icon-button.ts';
import { icon } from '../atoms/icon.ts';

export interface AttachmentChipOptions {
  name: string;
  size: number;
  /** When given, the chip shows a remove button. */
  onRemove?: () => void;
}

export function attachmentChip(options: AttachmentChipOptions): HTMLElement {
  return h('div', { className: 'attachment-chip' }, [
    h('span', { className: 'attachment-chip__icon' }, [icon('file', 16)]),
    h('span', { className: 'attachment-chip__text' }, [
      h('span', { className: 'attachment-chip__name', text: options.name, attrs: { title: options.name } }),
      h('span', { className: 'attachment-chip__size', text: formatFileSize(options.size) }),
    ]),
    options.onRemove &&
      iconButton({
        icon: 'close',
        label: tr.chat.removeAttachment(options.name),
        className: 'attachment-chip__remove',
        onClick: options.onRemove,
      }),
  ]);
}
