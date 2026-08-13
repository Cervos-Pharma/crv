/**
 * @file lib/i18n/server.ts
 * @description Server-side language helpers for the Cervos bilingual (EN / SW) system.
 *
 * Server Components cannot use the client-only `useI18n()` hook, so this module
 * provides the equivalent reading the `cervos_lang` cookie set by the client toggle.
 *
 * Usage in an async server component:
 * ```ts
 * import { getT } from "@/lib/i18n/server";
 * export default async function Page() {
 *   const t = await getT();
 *   return <h1>{t("download.hero.title")}</h1>;
 * }
 * ```
 *
 * To render the initial language into the client provider (root layout):
 * ```ts
 * import { getLang } from "@/lib/i18n/server";
 * const lang = await getLang();
 * // → <LanguageProvider initialLang={lang}>
 * ```
 */

import { cookies } from "next/headers";
import { type Lang, strings } from "./translations";

export const LANG_COOKIE = "cervos_lang";

/**
 * Reads the persisted language from the `cervos_lang` cookie.
 * Defaults to `"EN"` when the cookie is absent or invalid.
 *
 * @returns The active language code
 */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const raw = store.get(LANG_COOKIE)?.value;
  return raw === "SW" ? "SW" : "EN";
}

/**
 * Builds a server-side translator bound to the current cookie language.
 * Equivalent to the client `t()` from `useI18n()`.
 *
 * @returns An async-bound `t(key, fallback?)` function
 */
export async function getT() {
  const lang = await getLang();
  return (key: string, fallback?: string): string =>
    strings[key]?.[lang] ?? fallback ?? key;
}
