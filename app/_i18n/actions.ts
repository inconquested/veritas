"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { locales, type Locale } from "./config";
import { LOCALE_COOKIE } from "./request";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setLocale(locale: Locale) {
  if (!(locales as readonly string[]).includes(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
