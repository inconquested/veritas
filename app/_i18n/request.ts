import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import { defaultLocale } from './config';

export default getRequestConfig(async () => {
    const headersList = await headers();
    const locale = headersList.get('x-locale') || defaultLocale;
    const messages = await import(`./locales/${locale}.json`);

    return {
        locale,
        messages: messages.default || messages
    };
});