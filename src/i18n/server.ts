/**
 * QNT-0021 · Server-only locale resolution.
 *
 * Reads the request's cookies and Accept-Language header through the TanStack
 * SSR context (never window/document/navigator). Used by the root route's
 * beforeLoad so the first SSR response already uses the resolved language.
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start-server';
import { LOCALE_COOKIE, readCookieValue, resolveServerLocale, type LocaleResolution } from './locale';

export const resolveLocaleForRequest = createServerFn().handler(async (): Promise<LocaleResolution> => {
  const request = getRequest();
  const cookieLocale = readCookieValue(request.headers.get('cookie'), LOCALE_COOKIE);
  const acceptLanguage = request.headers.get('accept-language');
  return resolveServerLocale({ cookieLocale, acceptLanguage });
});