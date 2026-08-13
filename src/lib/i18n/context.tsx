/**
 * @file lib/i18n/context.tsx
 * @description Cervos bilingual (EN / SW) language system.
 *
 * Provides a React context with the current language, a setter, and a `t(key)` translator.
 * Language selection persists to BOTH a `cervos_lang` cookie (readable by server
 * components for server-side translation) and `localStorage` under the same key.
 *
 * The provider accepts an `initialLang` prop — the root layout reads the cookie
 * server-side and passes it in, so the client hydrates with the same language the
 * server rendered (no flash / hydration mismatch).
 *
 * Usage in client components:
 * ```tsx
 * import { useI18n } from "@/lib/i18n/context";
 * const { lang, setLang, t } = useI18n();
 * return <h1>{t("hero.headline")}</h1>;
 * ```
 *
 * The provider is mounted once in `src/providers.tsx`, which wraps the root layout.
 * All translation keys are defined in `lib/i18n/translations.ts`.
 *
 * Cookie name: `"cervos_lang"` (same as the localStorage key). Server components
 * should read it via `lib/i18n/server.ts` → `getLang()` / `getT()`.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type Lang, strings } from "./translations";

/** Shape of the I18n context value available via `useI18n()`. */
interface I18nContextValue {
  /** Currently active language code. */
  lang: Lang;
  /** Switch the active language and persist the choice to localStorage. */
  setLang: (l: Lang) => void;
  /**
   * Translates a key to the current language.
   * Falls back to `fallback` (if provided), then to the raw `key` string.
   *
   * @param key      - A dot-notation key from `translations.ts` (e.g. `"nav.login"`)
   * @param fallback - Optional string to return when the key is not found
   */
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "EN",
  setLang: () => {},
  t: (key) => key,
});

/**
 * Mounts the I18n context. Must wrap the entire component tree — place in the
 * root layout via `providers.tsx`.
 *
 * @param initialLang - Language detected server-side (from the `cervos_lang` cookie).
 *                      Used as the initial state so client hydration matches the
 *                      server-rendered language. Defaults to `"EN"`.
 * @param children    - The React subtree to provide language context to
 */
export function LanguageProvider({
  initialLang = "EN",
  children,
}: {
  initialLang?: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("cervos_lang", l);
    // Cookie lets server components render the same language on the next request.
    document.cookie = `cervos_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return strings[key]?.[lang] ?? fallback ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to access the I18n context. Must be used inside a `LanguageProvider`.
 *
 * @returns `{ lang, setLang, t }` — current language, setter, and translator function
 * @throws Silently returns the default EN context if called outside a provider
 */
export function useI18n() {
  return useContext(I18nContext);
}
