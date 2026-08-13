/**
 * @route /supplier/subscription
 * @access Authenticated supplier accounts only.
 *         Pharmacy accounts are redirected to /dashboard.
 * @description Shows supplier their subscription status, download access, and verification badge.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupplierSidebar from "@/components/SupplierSidebar";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function SupplierSubscriptionPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/supplier/subscription");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type, subscription_status, subscription_expires_at, download_enabled, verified")
    .eq("auth_user_id", user.id)
    .single();

  if (account?.type !== "supplier") redirect("/dashboard");

  const subscriptionStatus = account?.subscription_status ?? "inactive";
  const subscriptionExpires = account?.subscription_expires_at
    ? new Date(account.subscription_expires_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const downloadEnabled = account?.download_enabled ?? false;
  const verified = account?.verified ?? false;

  const statusConfig = {
    active: {
      label: t("sup.subscription.status_active"),
      description: t("sup.subscription.status_active_desc"),
      color: "text-success bg-success/10 border-success/20",
      icon: "check_circle",
    },
    trial: {
      label: t("sup.subscription.status_trial"),
      description: t("sup.subscription.status_trial_desc"),
      color: "text-amber-600 bg-amber-50 border-amber-200",
      icon: "schedule",
    },
    expired: {
      label: t("sup.subscription.status_expired"),
      description: t("sup.subscription.status_expired_desc"),
      color: "text-error bg-error/10 border-error/20",
      icon: "error",
    },
    inactive: {
      label: t("sup.subscription.status_inactive"),
      description: t("sup.subscription.status_inactive_desc"),
      color: "text-on-surface-variant bg-surface-container-low border-outline-variant",
      icon: "cancel",
    },
  };

  const currentStatus = statusConfig[subscriptionStatus as keyof typeof statusConfig] ?? statusConfig.inactive;

  return (
    <div className="flex min-h-screen bg-surface">
      <SupplierSidebar accountName={account?.name} />
      <div className="ml-64 flex-1 flex flex-col">
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-8 w-[calc(100%-16rem)] z-10">
          <div>
            <p className="font-mono text-label-md text-on-surface-variant uppercase tracking-widest mb-0.5">
              {t("sup.subscription.account_overview")}
            </p>
            <h1 className="font-headline-md text-headline-md text-ink-deep leading-none">{t("sup.subscription.title")}</h1>
          </div>
        </header>

        <main className="pt-16 flex-1 px-8 py-8">
          <div className="max-w-2xl space-y-8">
            <div className="bg-surface-base border border-outline-variant rounded-lg p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${currentStatus.color.split(" ").slice(1).join(" ")}`}>
                  <span className={`material-symbols-outlined text-[24px] ${currentStatus.color.split(" ")[0]}`}>
                    {currentStatus.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-headline-md text-headline-md text-ink-deep">{t("sup.subscription.sub_status")}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-label-md border ${currentStatus.color}`}>
                      {currentStatus.label}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">{currentStatus.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                    {t("sup.subscription.sub_type")}
                  </p>
                  <p className="font-body-lg text-body-lg text-ink-deep capitalize">
                    {subscriptionStatus === "active" ? t("sup.subscription.full_sub") :
                     subscriptionStatus === "trial" ? t("sup.subscription.trial_period") :
                     subscriptionStatus === "expired" ? t("sup.subscription.status_expired") : t("sup.subscription.not_subscribed")}
                  </p>
                </div>
                {subscriptionExpires && (
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                      {subscriptionStatus === "expired" ? t("sup.subscription.expires_on") : t("sup.subscription.valid_until")}
                    </p>
                    <p className="font-body-lg text-body-lg text-ink-deep">{subscriptionExpires}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-base border border-outline-variant rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    downloadEnabled ? "bg-success/10" : "bg-surface-container-low"
                  }`}>
                    <span className={`material-symbols-outlined text-[20px] ${
                      downloadEnabled ? "text-success" : "text-on-surface-variant"
                    }`}>
                      {downloadEnabled ? "download" : "download_for_offline"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-ink-deep">{t("sup.subscription.desktop_app")}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {downloadEnabled ? t("sup.subscription.download_enabled") : t("sup.subscription.download_disabled")}
                    </p>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {downloadEnabled
                    ? t("sup.subscription.download_enabled_desc")
                    : t("sup.subscription.download_disabled_desc")}
                </p>
              </div>

              <div className="bg-surface-base border border-outline-variant rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    verified ? "bg-primary/10" : "bg-surface-container-low"
                  }`}>
                    <span className={`material-symbols-outlined text-[20px] ${
                      verified ? "text-primary" : "text-on-surface-variant"
                    }`}>
                      {verified ? "verified" : "info"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-ink-deep">{t("sup.subscription.marketplace_verification")}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {verified ? t("sup.subscription.verified") : t("sup.subscription.not_verified")}
                    </p>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {verified
                    ? t("sup.subscription.verified_desc")
                    : t("sup.subscription.not_verified_desc")}
                </p>
              </div>
            </div>

            <div className="bg-surface-base border border-outline-variant rounded-lg p-6">
              <h3 className="font-label-md text-label-md text-ink-deep mb-4 uppercase tracking-wider">
                {t("sup.subscription.what_means")}
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-success/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
                  </div>
                  <div>
                    <p className="font-body-md text-body-md text-ink-deep mb-1">{t("sup.subscription.status_active")}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {t("sup.subscription.status_active_desc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">schedule</span>
                  </div>
                  <div>
                    <p className="font-body-md text-body-md text-ink-deep mb-1">{t("sup.subscription.status_trial")}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {t("sup.subscription.status_trial_desc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-error/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-error">error</span>
                  </div>
                  <div>
                    <p className="font-body-md text-body-md text-ink-deep mb-1">{t("sup.subscription.status_expired")} / {t("sup.subscription.status_inactive")}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {t("sup.subscription.status_expired_desc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 bg-ink-deep text-white px-6 py-3 font-label-md text-label-md hover:opacity-90 transition-opacity rounded"
              >
                <span className="material-symbols-outlined text-[16px]">contact_support</span>
                {t("sup.subscription.contact_hq")}
              </Link>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {t("sup.subscription.contact_hq_body")}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
