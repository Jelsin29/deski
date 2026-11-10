// Tiny element builder. Text is always assigned through textContent, so
// user-provided strings can never become markup.

type Child = Node | string | null | undefined | false;

type Listeners = {
  [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void;
};

export interface ElementOptions {
  className?: string;
  text?: string;
  /** `true` sets an empty attribute, `false` omits it. */
  attrs?: Record<string, string | boolean>;
  on?: Listeners;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value === true) element.setAttribute(name, '');
    else if (value !== false) element.setAttribute(name, value);
  }
  for (const [type, listener] of Object.entries(options.on ?? {})) {
    element.addEventListener(type, listener as EventListener);
  }

  element.append(...children.filter((child): child is Node | string => Boolean(child)));
  return element;
}
