"use client";

import { LanguageProvider } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/translations";
import type { ReactNode } from "react";

export default function Providers({
  initialLang = "EN",
  children,
}: {
  initialLang?: Lang;
  children: ReactNode;
}) {
  return <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>;
}
