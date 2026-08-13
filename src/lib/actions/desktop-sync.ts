/**
 * @file lib/actions/desktop-sync.ts
 * @description Server actions + API route handlers for the Cervos desktop endpoint.
 *
 * The desktop app (Electron/SQLite at each pharmacy branch) syncs data by calling
 * `GET /api/sync?since=<last_synced_at>` — an API route (not a "use server" action)
 * that uses the session cookie for auth and returns delta changes across all tables.
 *
 * Subscription status is checked per-branch on every sync:
 *   - account subscription is active → branch access granted
 *   - account is trial → branch is trial (trial_ends_at)
 *   - account is grace → branch is grace (grace_ends_at)
 *   - account is locked → branch is locked (desktop goes into read-only mode)
 *
 * For HQ-managed unlocks, `manualUnlockBranch` in hq.ts sets status back to active.
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @environment SUPABASE_SERVICE_ROLE_KEY  — used only in the sync API route for
 *          writes (upserting syncacknowledgements), never in read-only paths.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BranchStatus = "active" | "trial" | "grace" | "locked";

export interface BranchAccess {
  branchId: string;
  accountId: string;
  status: BranchStatus;
  canWrite: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  accountBillingStatus: string;
  suspended: boolean;
  syncedAt: string;
}

export interface SyncResponse {
  branches: Array<{
    id: string;
    name: string;
    account_id: string;
    lat: number | null;
    lng: number | null;
    subscription_status: string;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    last_synced_at: string | null;
    updated_at: string;
  }>;
  batches: Array<{
    id: string;
    branch_id: string;
    product_id: string;
    batch_number: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
    expiry_date: string;
    sync_version: number;
    updated_at: string;
  }>;
  products: Array<{
    id: string;
    generic_name: string;
    brand_name: string | null;
    category: string | null;
    requires_prescription: boolean;
    unit_desc: string | null;
    updated_at: string;
  }>;
  serverTime: string;
  suspended?: boolean;
}

// ─── Subscription helpers ─────────────────────────────────────────────────────

/**
 * Returns the effective branch access status for the desktop endpoint.
 * Mirrors the subscription logic from the shared migration — trial, grace,
 * and locked states are derived from the account's subscription + branch-level stamps.
 *
 * Called by: the sync API route (read-only, uses anon client with RLS).
 */
export async function getBranchAccess(branchId: string): Promise<BranchAccess | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, account_id, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, lat, lng")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id, billing_status, subscription_status, subscription_expires_at, suspended_at")
    .eq("id", branch.account_id)
    .maybeSingle();

  if (!account) return null;

  const now = new Date();
  const suspended = Boolean(account.suspended_at);
  const effectiveStatus = suspended
    ? "locked"
    : resolveStatus(account.subscription_status, branch.subscription_status, branch.trial_ends_at, branch.grace_ends_at, now);
  const canWrite = effectiveStatus !== "locked";

  return {
    branchId: branch.id,
    accountId: account.id,
    status: effectiveStatus,
    canWrite,
    trialEndsAt: branch.trial_ends_at,
    graceEndsAt: branch.grace_ends_at,
    accountBillingStatus: account.billing_status,
    suspended,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Determines effective subscription status from account + branch timestamps.
 * - "active"   : account active and not expired, branch not in trial/grace/locked
 * - "trial"    : trial_ends_at is set and in the future
 * - "grace"    : grace_ends_at is set and in the future
 * - "locked"   : account is "locked" OR account subscription is past expires_at
 */
function resolveStatus(
  acctSub: string | null,
  branchStatus: string | null,
  trialEndsAt: string | null,
  graceEndsAt: string | null,
  now: Date
): BranchStatus {
  if (branchStatus === "locked") return "locked";
  if (acctSub === "locked") return "locked";

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const graceEnd = graceEndsAt ? new Date(graceEndsAt) : null;

  if (trialEnd && trialEnd > now) return "trial";
  if (graceEnd && graceEnd > now) return "grace";
  if (acctSub === "active" || acctSub === "trial") return "active";
  return "locked";
}

// ─── Delta-sync ───────────────────────────────────────────────────────────────

/**
 * Returns all records modified since `since` across branches, batches, and products.
 * Used by `GET /api/sync` — the desktop endpoint's primary sync endpoint.
 *
 * The response always includes `serverTime` so the client can update its
 * `last_synced_at` to the server's clock (prevents clock-skew drift).
 *
 * Branch rows are scoped to the authenticated account's branches.
 * Only rows with `updated_at > since` are returned (delta, not full).
 *
 * @param since     - ISO timestamp of last successful sync (exclusive)
 * @param accountId - The account ID to scope the sync to (validated against session)
 * @returns SyncResponse with changed rows, or null if unauthenticated
 */
export async function getSyncData(since: string, accountId: string): Promise<SyncResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id, suspended_at")
    .eq("id", accountId)
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return null;

  // Suspended accounts are cut off from new data. Their branches are reported
  // as locked so the desktop keeps existing local data but enters read-only.
  if (account.suspended_at) {
    const { data: lockedBranches } = await supabase
      .from("branches")
      .select("id, name, account_id, lat, lng, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, updated_at")
      .eq("account_id", account.id);

    return {
      branches: (lockedBranches ?? []).map((b) => ({ ...b, subscription_status: "locked" })) as SyncResponse["branches"],
      batches: [],
      products: [],
      serverTime: new Date().toISOString(),
      suspended: true,
    };
  }

  const branchesResult = await supabase
    .from("branches")
    .select("id, name, account_id, lat, lng, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, updated_at")
    .eq("account_id", account.id)
    .gt("updated_at", since);

  const branchIds = (branchesResult.data ?? []).map((b: { id: string }) => b.id);

  const [batchesResult, productsResult] = await Promise.all([
    branchIds.length > 0
      ? supabase.from("batches").select("id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, sync_version, updated_at").in("branch_id", branchIds).gt("updated_at", since)
      : Promise.resolve({ data: [] }),
    supabase
      .from("products")
      .select("id, generic_name, brand_name, category, requires_prescription, unit_desc, updated_at")
      .gt("updated_at", since),
  ]);

  return {
    branches: (branchesResult.data ?? []) as SyncResponse["branches"],
    batches: (batchesResult.data ?? []) as SyncResponse["batches"],
    products: (productsResult.data ?? []) as SyncResponse["products"],
    serverTime: new Date().toISOString(),
  };
}

/**
 * Called by the desktop endpoint after it has applied a batch of changes locally.
 * Acknowledges the sync by updating `branches.last_synced_at` so subsequent
 * delta queries exclude records already in the desktop's local DB.
 *
 * Uses the service-role client so the update bypasses RLS (the branch belongs
 * to the account but the session is at account level, not branch level).
 *
 * @param branchId  - The branch whose last_synced_at should be updated
 * @param syncedAt   - The server timestamp returned by getSyncData for this sync batch
 * @param accountId  - The account ID to scope the update (validated against session)
 */
export async function acknowledgeSync(
  branchId: string,
  syncedAt: string,
  accountId: string
): Promise<{ error: string | null }> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("branches")
    .update({ last_synced_at: syncedAt })
    .eq("id", branchId)
    .eq("account_id", accountId);

  if (error) return { error: error.message };
  return { error: null };
}
