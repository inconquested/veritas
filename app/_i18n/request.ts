import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

export const LOCALE_COOKIE = "NEXT_LOCALE";

function resolveLocale(candidate: string | undefined): Locale {
  if (!candidate) return defaultLocale;
  return (locales as readonly string[]).includes(candidate)
    ? (candidate as Locale)
    : defaultLocale;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`./locales/${locale}.json`)).default;

  return { locale, messages };
});
