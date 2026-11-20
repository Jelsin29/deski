import type { ApiError } from '../../shared/deski-api.js';
import { tr } from '../i18n/tr.ts';

/** Turns a bridge error into one sentence the user can understand. */
export function errorMessage(error: ApiError): string {
  const base = tr.errors[error.kind];
  if (error.kind === 'offline') return base;
  const status = error.status === null ? '' : ` (${error.status})`;
  const detail = error.detail ? ` ${error.detail}` : '';
  return `${base}${status}${detail}`;
}
