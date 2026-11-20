import { h } from '../../dom.ts';
import { icon, type IconName } from './icon.ts';

export interface IconButtonOptions {
  icon: IconName;
  /** Accessible name; also shown as a tooltip. */
  label: string;
  /** Optional for submit buttons, which are handled by their form. */
  onClick?: (event: MouseEvent) => void;
  className?: string;
  type?: 'button' | 'submit';
}

export function iconButton(options: IconButtonOptions): HTMLButtonElement {
  return h(
    'button',
    {
      className: ['icon-button', options.className].filter(Boolean).join(' '),
      attrs: { type: options.type ?? 'button', 'aria-label': options.label, title: options.label },
      on: options.onClick ? { click: options.onClick } : {},
    },
    [icon(options.icon)],
  );
}
