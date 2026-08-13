/**
 * @file lib/actions/pharmacy.ts
 * @description Server actions for the pharmacy portal dashboard.
 *
 * Supabase tables touched:
 *   - accounts  — read (id, name, billing_status, download_enabled, type)
 *   - branches  — read (all branch fields including lat/lng for map)
 *   - batches   — read near-expiry batches (joined with products, branches)
 *
 * Uses the anon-key Supabase client — all queries are scoped to the
 * authenticated user via `auth_user_id` on the accounts table.
 * Row Level Security on Supabase enforces the user ↔ account boundary.
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Fetches everything the pharmacy dashboard needs in a single server action:
 * the account row, all branches, and near-expiry batches (within 30 days).
 *
 * Returns null if no authenticated user or no matching account row.
 *
 * @returns `{ account, branches, expiringBatches }` or null if unauthenticated
 */
export async function getPharmacyDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, billing_status, download_enabled, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return null;

  const { data: branches } = await supabase
    .from("branches")
    .select(
      "id, name, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, lat, lng"
    )
    .eq("account_id", account.id)
    .order("name");

  // Near-expiry batches — only fetch if there are branches to query.
  // Without this guard, `.in("branch_id", [])` produces an invalid Supabase query
  // when the account has no branches yet (new sign-ups, test accounts).
  const branchIds = (branches ?? []).map((b) => b.id);

  const expiringBatches =
    branchIds.length === 0
      ? []
      : await (async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() + 30);
          const { data } = await supabase
            .from("batches")
            .select(
              "id, quantity, expiry_date, product_id, branch_id, products(generic_name, brand_name), branches(name)"
            )
            .in("branch_id", branchIds)
            .lte("expiry_date", cutoff.toISOString().slice(0, 10))
            .gt("quantity", 0)
            .order("expiry_date", { ascending: true })
            .limit(10);
          return data ?? [];
        })();

  return {
    account,
    branches: branches ?? [],
    expiringBatches,
  };
}
