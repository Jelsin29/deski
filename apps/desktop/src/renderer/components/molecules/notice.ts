import { h } from '../../dom.ts';
import { icon } from '../atoms/icon.ts';

export type NoticeTone = 'error' | 'success' | 'warning';

/** Inline status line; announced politely to screen readers. */
export function notice(tone: NoticeTone, message: string): HTMLElement {
  return h('p', { className: `notice notice--${tone}`, attrs: { role: 'status' } }, [
    icon(tone === 'success' ? 'check' : 'alert', 16),
    h('span', { text: message }),
  ]);
}
