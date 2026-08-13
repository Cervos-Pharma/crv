/**
 * @file components/ComingSoon.tsx
 * @description Full-area placeholder for routes that are not yet implemented.
 * Displays a construction icon, a localized "Coming Soon" label, the section title,
 * an optional description, and a back-navigation button.
 *
 * Localization: uses `t("common.comingsoon")`, `t("common.notconfigured")`,
 * and `t("common.backhome")` from the i18n system. These can be overridden via props.
 */
"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface ComingSoonProps {
  /** Page or section title displayed as the main heading. */
  title: string;
  /** Optional description. Falls back to `t("common.notconfigured")`. */
  description?: string;
  /** href for the back button. Defaults to "/". */
  backHref?: string;
  /** Label for the back button. Falls back to `t("common.backhome")`. */
  backLabel?: string;
}

export default function ComingSoon({
  title,
  description,
  backHref = "/",
  backLabel,
}: ComingSoonProps) {
  const { t } = useI18n();
  const desc = description ?? t("common.notconfigured");
  const label = backLabel ?? t("common.backhome");

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-24">
      <div className="max-w-lg text-center">
        <div className="inline-block mb-8">
          <div className="custom-notch bg-surface-container-low border border-outline-variant p-6">
            <span className="material-symbols-outlined text-[48px] text-primary">construction</span>
          </div>
        </div>
        <p className="font-label-md text-label-md text-primary uppercase tracking-wider mb-3">
          {t("common.comingsoon")}
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-4">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">{desc}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded hover:scale-[1.02] transition-transform gaming-snap"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {label}
        </Link>
      </div>
    </div>
  );
}
