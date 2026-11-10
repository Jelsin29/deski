import type { DeskiApi, Provider } from '../../shared/deski-api.js';
import { errorMessage } from '../api/error-message.ts';
import { iconButton } from '../components/atoms/icon-button.ts';
import { notice } from '../components/molecules/notice.ts';
import { h } from '../dom.ts';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  modelForProvider,
  providerOption,
  type ProviderOption,
} from '../features/settings/providers.ts';
import type { ThemePreference } from '../features/settings/theme.ts';
import { tr } from '../i18n/tr.ts';

type SettingsApi = Pick<
  DeskiApi,
  'backendMode' | 'checkHealth' | 'getSettings' | 'updateSettings' | 'saveToken'
>;

export interface SettingsPageOptions {
  theme: ThemePreference;
  onBack(): void;
  onThemeChange(theme: ThemePreference): void;
}

export interface SettingsPageView {
  element: HTMLElement;
  /** Reloads backend state each time the page is shown. */
  open(): Promise<void>;
}

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function section(title: string, description: HTMLElement, body: HTMLElement): HTMLElement {
  return h('section', { className: 'settings-section' }, [
    h('h2', { className: 'settings-section__title', text: title }),
    description,
    body,
  ]);
}

function description(text: string): HTMLParagraphElement {
  return h('p', { className: 'settings-section__description', text });
}

function primaryButton(label: string): HTMLButtonElement {
  return h('button', { className: 'button button--primary', text: label, attrs: { type: 'submit' } });
}

/** Disables the button while the action runs so it cannot be sent twice. */
async function whileBusy(button: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
  button.disabled = true;
  try {
    await action();
  } finally {
    button.disabled = false;
  }
}

export function createSettingsPage(api: SettingsApi, options: SettingsPageOptions): SettingsPageView {
  let provider: Provider = DEFAULT_PROVIDER;

  const backendBadge = h('span', { className: 'status-badge' });
  const providerStatus = h('div', { className: 'form-status' });
  const tokenStatus = h('div', { className: 'form-status' });

  // Provider and model
  const providerInputs = PROVIDERS.map((option) =>
    h('input', {
      attrs: { type: 'radio', name: 'provider', value: option.id },
      on: { change: () => selectProvider(option.id) },
    }),
  );
  const modelOptions = h('datalist', { attrs: { id: 'model-options' } });
  const modelInput = h('input', {
    className: 'text-input',
    attrs: {
      id: 'model-input',
      type: 'text',
      list: 'model-options',
      required: true,
      maxlength: '128',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });
  const providerSave = primaryButton(tr.settings.provider.save);

  const providerCard = (option: ProviderOption, input: HTMLInputElement): HTMLElement =>
    h('label', { className: 'choice-card' }, [
      input,
      h('span', { className: 'choice-card__title', text: option.name }),
      h('span', { className: 'choice-card__description', text: tr.settings.provider[option.id] }),
    ]);

  const providerForm = h('form', { className: 'settings-section__body', on: { submit: saveProvider } }, [
    h(
      'fieldset',
      { className: 'choice-grid' },
      [
        h('legend', { className: 'visually-hidden', text: tr.settings.provider.title }),
        ...PROVIDERS.map((option, index) => providerCard(option, providerInputs[index]!)),
      ],
    ),
    h('div', { className: 'field' }, [
      h('label', { className: 'field__label', text: tr.settings.provider.model, attrs: { for: 'model-input' } }),
      modelInput,
      modelOptions,
      h('span', { className: 'field__hint', text: tr.settings.provider.modelHint }),
    ]),
    h('div', { className: 'form-actions' }, [providerSave, providerStatus]),
  ]);

  // API key
  const tokenDescription = description('');
  const tokenInput = h('input', {
    className: 'text-input',
    attrs: { id: 'token-input', type: 'password', required: true, maxlength: '4096', autocomplete: 'off', spellcheck: 'false' },
  });
  const tokenSave = primaryButton(tr.settings.token.save);
  const tokenForm = h('form', { className: 'settings-section__body', on: { submit: saveToken } }, [
    h('div', { className: 'field' }, [
      h('label', { className: 'field__label', text: tr.settings.token.label, attrs: { for: 'token-input' } }),
      tokenInput,
    ]),
    h('div', { className: 'form-actions' }, [tokenSave, tokenStatus]),
  ]);

  // Appearance
  const themePicker = h(
    'div',
    { className: 'segmented', attrs: { role: 'radiogroup', 'aria-label': tr.settings.appearance.title } },
    THEMES.map((theme) =>
      h('label', { className: 'segmented__option' }, [
        h('input', {
          attrs: { type: 'radio', name: 'theme', value: theme, checked: theme === options.theme },
          on: { change: () => options.onThemeChange(theme) },
        }),
        h('span', { text: tr.settings.appearance[theme] }),
      ]),
    ),
  );

  const element = h('section', { className: 'page settings-page' }, [
    h('header', { className: 'page-header titlebar-drag' }, [
      iconButton({ icon: 'arrowLeft', label: tr.settings.back, onClick: options.onBack }),
      h('h1', { className: 'page-header__title', text: tr.settings.title }),
      backendBadge,
    ]),
    h('div', { className: 'settings-page__content' }, [
      section(tr.settings.provider.title, description(tr.settings.provider.description), providerForm),
      section(tr.settings.token.title, tokenDescription, tokenForm),
      section(tr.settings.appearance.title, description(tr.settings.appearance.description), themePicker),
    ]),
  ]);

  function selectProvider(id: Provider, model = modelInput.value): void {
    provider = id;
    providerInputs.forEach((input) => { input.checked = input.value === id; });
    modelInput.value = modelForProvider(id, model);
    modelOptions.replaceChildren(...providerOption(id).models.map((name) => h('option', { attrs: { value: name } })));
    tokenDescription.textContent = tr.settings.token.description(providerOption(id).name);
  }

  function setBackendBadge(state: 'checking' | 'connected' | 'disconnected' | 'fake'): void {
    backendBadge.className = `status-badge status-badge--${state}`;
    backendBadge.textContent = `${tr.settings.backend.label}: ${tr.settings.backend[state]}`;
  }

  function saveProvider(event: SubmitEvent): void {
    event.preventDefault();
    void whileBusy(providerSave, async () => {
      const result = await api.updateSettings({ provider, model: modelInput.value.trim() });
      providerStatus.replaceChildren(
        result.ok ? notice('success', tr.settings.provider.saved) : notice('error', errorMessage(result.error)),
      );
    });
  }

  function saveToken(event: SubmitEvent): void {
    event.preventDefault();
    void whileBusy(tokenSave, async () => {
      const result = await api.saveToken({ provider, apiKey: tokenInput.value });
      if (result.ok) tokenInput.value = '';
      const providerName = providerOption(provider).name;
      tokenStatus.replaceChildren(
        result.ok ? notice('success', tr.settings.token.saved(providerName)) : notice('error', errorMessage(result.error)),
      );
    });
  }

  async function open(): Promise<void> {
    providerStatus.replaceChildren();
    tokenStatus.replaceChildren();
    setBackendBadge('checking');

    const [health, settings] = await Promise.all([api.checkHealth(), api.getSettings()]);
    if (api.backendMode === 'fake') setBackendBadge('fake');
    else setBackendBadge(health.ok ? 'connected' : 'disconnected');
    if (settings.ok) {
      selectProvider(settings.data.provider, settings.data.model);
    } else {
      providerStatus.replaceChildren(notice('warning', errorMessage(settings.error)));
    }
  }

  selectProvider(provider);
  return { element, open };
}
