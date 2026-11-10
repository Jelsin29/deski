// Theme is a per-device UI preference, so it is stored locally rather than in
// the backend settings.
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'deski.theme';
const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadThemePreference(storage: KeyValueStorage): ThemePreference {
  const stored = storage.getItem(STORAGE_KEY);
  return PREFERENCES.find((preference) => preference === stored) ?? 'system';
}

export function saveThemePreference(storage: KeyValueStorage, preference: ThemePreference): void {
  storage.setItem(STORAGE_KEY, preference);
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}
