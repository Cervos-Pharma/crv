"use client";

import Link from "next/link";
import type { PharmacyAlert } from "@/lib/actions/pharmacy";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "error", label: "Critical" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "warning", label: "Warning" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "info", label: "Info" },
};

const CATEGORY_ICONS: Record<string, string> = {
  expiry: "schedule",
  stock: "inventory_2",
  sync: "sync",
  subscription: "subscriptions",
  branch: "store",
};

interface AlertsClientProps {
  alerts: PharmacyAlert[];
  error: string | null;
}

export default function AlertsClient({ alerts, error }: AlertsClientProps) {
  if (error) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        <p className="font-body-md">Failed to load alerts: {error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-surface border border-outline-variant rounded-xl p-16 text-center">
        <span className="material-symbols-outlined text-6xl text-secondary mb-4">verified</span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">All Clear</h2>
        <p className="font-body-md text-on-surface-variant">
          No active alerts. Your branches are running smoothly.
        </p>
      </div>
    );
  }

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-8">
      {critical.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            <h2 className="font-label-lg text-label-lg text-red-600 uppercase tracking-wider">
              Critical — {critical.length} alert{critical.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="space-y-3">
            {critical.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            <h2 className="font-label-lg text-label-lg text-amber-600 uppercase tracking-wider">
              Warnings — {warnings.length}
            </h2>
          </div>
          <div className="space-y-3">
            {warnings.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {infos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <h2 className="font-label-lg text-label-lg text-blue-600 uppercase tracking-wider">
              Informational — {infos.length}
            </h2>
          </div>
          <div className="space-y-3">
            {infos.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: PharmacyAlert }) {
  const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;

  return (
    <Link
      href={alert.route}
      className={`flex items-center gap-4 p-5 rounded-xl border ${style.bg} ${style.border} hover:opacity-80 transition-opacity block`}
    >
      <span className={`material-symbols-outlined text-2xl ${style.text}`}>
        {CATEGORY_ICONS[alert.category] ?? "info"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`font-label-md text-label-md font-semibold ${style.text}`}>{alert.title}</span>
          {alert.count > 1 && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${style.bg} ${style.text} border-current`}>
              {alert.count}
            </span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{alert.description}</p>
      </div>
      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
    </Link>
  );
}
