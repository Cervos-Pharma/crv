/**
 * @route /dashboard/billing
 * @access Authenticated pharmacy accounts only.
 * @description Self-service billing page for pharmacy users to view and change their subscription plan.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { selectPlan } from "@/lib/actions/pharmacy";
import PharmacySidebar from "@/components/PharmacySidebar";
import BillingClient from "./BillingClient";
import { getT } from "@/lib/i18n/server";

export default async function BillingPage() {
  const t = await getT();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/billing");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, subscription_plan, subscription_status, billing_status")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) redirect("/auth?next=/dashboard/billing");

  const { data: branches } = await supabase
    .from("branches")
    .select("id")
    .eq("account_id", account.id);

  const branchCount = (branches ?? []).length;

  const { data: plansData } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price_monthly_tzs", { ascending: true });

  const plans = (plansData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_monthly_tzs: Number(p.price_monthly_tzs) || 0,
    price_annual_tzs: Number(p.price_annual_tzs) || 0,
    max_branches: p.max_branches ?? 1,
    max_operators: p.max_operators ?? 5,
    features: Array.isArray(p.features) ? p.features.map((f: unknown) => String(f)) : [],
  }));

  const { data: currentPlan } = await supabase
    .from("subscription_plans")
    .select("name")
    .eq("id", account.subscription_plan)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar
        accountName={account?.name}
      />

      <div className="ml-64 flex-1 flex flex-col">
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-8 w-[calc(100%-16rem)] z-10">
          <h2 className="font-headline-md text-headline-md text-ink-deep">
            {t("portal.billing")}
          </h2>
        </header>

        <main className="flex-grow pt-24 pb-24 px-8 max-w-container-max mx-auto w-full">
          <div className="mb-8">
            <h1 className="font-headline-lg text-headline-lg text-ink-deep mb-1">
              {t("billing.title")}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t("billing.subtitle")}
            </p>
          </div>

          <BillingClient
            account={{
              id: account.id,
              name: account.name,
              subscription_plan: account.subscription_plan,
              subscription_status: account.subscription_status,
              billing_status: account.billing_status,
            }}
            currentPlanName={currentPlan?.name}
            plans={plans}
            branchCount={branchCount}
            selectPlanAction={selectPlan}
          />
        </main>
      </div>
    </div>
  );
}
