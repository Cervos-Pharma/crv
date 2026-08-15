/**
 * @file components/HQSidebar.tsx
 * @description Fixed left navigation sidebar for the HQ Console (/hq/*).
 *
 * Highlights the active route using `usePathname()`. No props required —
 * nav items are statically defined (HQ has no per-user customisation).
 * Hidden on mobile (md:flex) — the HQ console is desktop-only.
 *
 * @prop openSupportCount - Optional live count of open support tickets (passed
 *   by HQSidebarServer, which fetches it server-side). Displays a badge on the
 *   Support nav item when > 0.
 */
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface HQSidebarProps {
  openSupportCount?: number;
}

const NAV = [
  { label: "Overview",       href: "/hq",                icon: "dashboard" },
  { label: "Intelligence",   href: "/hq/intelligence",   icon: "insights" },
  { label: "Accounts",       href: "/hq/accounts",       icon: "group" },
  { label: "Billing",        href: "/hq/billing",        icon: "payments" },
  { label: "Quote Requests", href: "/hq/quotes",         icon: "request_quote" },
  { label: "Invites",        href: "/hq/invites",        icon: "mail" },
  { label: "Network Map",    href: "/hq/network",        icon: "public" },
  { label: "Downloads",      href: "/hq/downloads",      icon: "download" },
  { label: "Support",        href: "/hq/support",        icon: "support_agent" },
  { label: "HQ Team",        href: "/hq/team",           icon: "badge" },
  { label: "News",           href: "/hq/news",           icon: "newspaper" },
  { label: "Messages",        href: "/hq/messages",       icon: "campaign" },
  { label: "Audit Log",      href: "/hq/audit",          icon: "shield" },
];

export default function HQSidebar({ openSupportCount = 0 }: HQSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col h-full py-6 bg-surface-container-low border-r border-outline-variant w-64 flex-shrink-0 z-40">
      <div className="px-6 mb-6">
        <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
          HQ Console
        </h2>
        <div className="font-mono text-[10px] text-on-surface-variant uppercase">
          Sector-01 Status: Nominal
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1 px-2">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/hq" && pathname.startsWith(item.href));
          const isSupport = item.href === "/hq/support";
          const showBadge = isSupport && openSupportCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 transition-all duration-75 ${
                active
                  ? "bg-primary text-on-primary font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span className="font-label-md text-label-md flex-1">{item.label}</span>
              {showBadge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  active
                    ? "bg-on-primary/20 text-on-primary"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {openSupportCount > 99 ? "99+" : openSupportCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
