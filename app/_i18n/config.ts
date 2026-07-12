import { getTranslations } from "next-intl/server";

export type Locale = (typeof locales)[number];
export const locales = ['en', 'id', 'es', 'zh-CN'] as const;
export const defaultLocale: Locale = 'id';

export const getI18n = async (locale: Locale) => getTranslations({ locale, namespace: "NextIntl" });