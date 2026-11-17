import type { TFunction } from 'i18next';

import { ApiError } from './client';

/** A translated, user-facing message for a failed auth request. */
export function authErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return t('errors.network');
    if (error.status === 401) return t('errors.invalidCredentials');
    if (error.status === 403) return t('errors.accountDisabled');
    if (error.status === 429) return t('errors.tooManyAttempts');
    if (error.status === 422 && error.errors.email) return t('errors.emailTaken');
  }
  if (error instanceof Error && error.message === 'key_unlock_failed') return t('errors.keyUnlock');

  return t('errors.generic');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
