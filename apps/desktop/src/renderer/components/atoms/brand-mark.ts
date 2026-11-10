import { h } from '../../dom.ts';

/** The Deski logo; the SVG file is the single source of the brand mark. */
export function brandMark(size: number): HTMLImageElement {
  return h('img', {
    className: 'brand-mark',
    attrs: { src: './assets/logo.svg', width: String(size), height: String(size), alt: '' },
  });
}
