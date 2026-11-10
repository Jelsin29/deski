import assert from 'node:assert/strict';
import test from 'node:test';
import { modelForProvider } from '../src/renderer/features/settings/providers.ts';
import { loadThemePreference, resolveTheme, saveThemePreference } from '../src/renderer/features/settings/theme.ts';

test('keeps a model that belongs to the provider, otherwise suggests its first model', () => {
  assert.equal(modelForProvider('openai', 'gpt-5-mini'), 'gpt-5-mini');
  assert.equal(modelForProvider('anthropic', 'gpt-5-mini'), 'claude-sonnet-5-5');
});

test('persists the theme preference and falls back to system', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };

  assert.equal(loadThemePreference(storage), 'system');
  saveThemePreference(storage, 'dark');
  assert.equal(loadThemePreference(storage), 'dark');
  data.set('deski.theme', 'neon');
  assert.equal(loadThemePreference(storage), 'system');
});

test('resolves the system preference to a concrete theme', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
});
