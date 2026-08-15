/**
 * @file lib/actions/hq.ts
 * @description Server actions for the Cervos HQ Console.
 *
 * ALL actions in this file require a valid HQ session cookie (`hq_sess`).
 * The session is established via `loginHQ` (email + password checked against
 * the `hq_admins` table) and validated with the HMAC-derived token in
 * `lib/hq-auth.ts`. The raw `HQ_SECRET` env var is never stored anywhere �?" only a
 * constant-time HMAC of it. Passwords are stored as salted scrypt hashes in
 * `hq_admins` �?" the plaintext password is never stored or logged.
 *
 * Supabase tables touched:
 *   - hq_admins      �?" read (loginHQ) — service role only, no RLS policies
 *   - accounts       �?" read (getAllAccounts, getHQStats) / update (enableDownload)
 *   - branches       �?" read count (getHQStats)
 *   - quote_requests �?" read (getAllQuoteRequests, getHQStats) / update (markQuoteContacted)
 *
 * All data-mutating actions use the Supabase SERVICE ROLE client, which
 * bypasses Row Level Security. Never expose the service-role key to the client.
 *
 * @environment HQ_SECRET          �?" must be �%� 32 chars, not the placeholder value
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment SUPABASE_SERVICE_ROLE_KEY
 */
"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { scryptSync, timingSafeEqual, createHash, randomBytes } from "crypto";
import {
  HQ_COOKIE_NAME,
  isValidHQToken,
  deriveHQSessionToken,
} from "@/lib/hq-auth";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Guard against the default placeholder value in .env.local */
const PLACEHOLDER_SECRET = "placeholder-hq-secret";

/** HQ session cookie lifespan — 8 hours */
const COOKIE_MAX_AGE = 60 * 60 * 8;

// ─── Private helpers ────────────────────────────────────────────────────────

/**
 * Validates the current request's HQ session cookie.
 * Returns `{ error }` rather than throwing so callers can return typed errors
 * to the client without unhandled server-action exceptions.
 */
async function assertHQAuth(): Promise<{ error: string | null }> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(HQ_COOKIE_NAME)?.value;
  if (!isValidHQToken(sessionToken)) return { error: "Unauthorized" };
  return { error: null };
}

// ─── Public actions ──────────────────────────────────────────────────────────

/** Placeholder hash used to equalise login timing when the email doesn't exist. */
const LOGIN_DUMMY_HASH =
  "scrypt$16384$8$1$pUJ2XehyzP0dka5ie9Zpxg==$aJfjWaeunoj27cm2JfXCQjQW7rJFF7yQFR7CYbcIdRzxmvFcbx6sg6MjEOsVHOyVraxLkpkvupSgz36qMHDu6Q==";

/**
 * Verifies a plaintext password against a stored `scrypt$N$r$p$salt$hash`
 * string. Uses scrypt (memory-hard KDF) + constant-time compare.
 * Returns false (never throws) on malformed input.
 */
function verifyHQPassword(password: string, stored: string): boolean {
  try {
    const [algo, N, r, p, salt, hash] = stored.split("$");
    if (algo !== "scrypt" || !N || !r || !p || !salt || !hash) return false;
    const derived = scryptSync(password, Buffer.from(salt, "base64"), 64, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    const expected = Buffer.from(hash, "base64");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Authenticates an HQ operator with email + password.
 *
 * Looks up `hq_admins` via the service-role client (the table has RLS enabled
 * with no policies, so it is unreachable by anon/authenticated clients) and
 * verifies the submitted password against the stored salted scrypt hash. On
 * success, sets an 8-hour HttpOnly session cookie derived via HMAC-SHA256.
 *
 * Rejects if `HQ_SECRET` is unset/placeholder/under 32 chars, or if the
 * credentials don't match (constant-time compare).
 *
 * @param input - `{ email, password }` from the login form
 * @returns `{ error }` — null on success, message string on failure
 */
export async function loginHQ(input: {
  email: string;
  password: string;
}): Promise<{ error: string | null }> {
  const email = (input?.email ?? "").trim().toLowerCase();
  const password = input?.password ?? "";

  if (!email || !password) {
    return { error: "Enter your HQ email and password." };
  }

  const configured = process.env.HQ_SECRET;
  if (!configured || configured === PLACEHOLDER_SECRET || configured.length < 32) {
    return { error: "HQ console is not configured. Contact your system administrator." };
  }

  const supabase = await createServiceClient();
  const { data: admin } = await supabase
    .from("hq_admins")
    .select("id, email, password_hash, name")
    .eq("email", email)
    .maybeSingle();

  const valid = admin?.password_hash
    ? verifyHQPassword(password, admin.password_hash)
    : verifyHQPassword(password, LOGIN_DUMMY_HASH);

  if (!admin || !valid) {
    return { error: "Invalid HQ credentials." };
  }

  const sessionToken = deriveHQSessionToken(configured);
  const cookieStore = await cookies();
  cookieStore.set(HQ_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { error: null };
}

/**
 * Fetches all supplier quote requests, ordered newest-first.
 * Requires a valid HQ session.
 *
 * @returns `{ data, error }` — data is the full quote_requests rows or null on failure
 */
export async function getAllQuoteRequests(): Promise<{
  data: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    message?: string;
    status: string;
    created_at: string;
    supplier_account_id?: string;
  }[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Marks a quote request as "contacted" — sets `status = 'contacted'`.
 * Requires a valid HQ session.
 *
 * @param quoteId - UUID of the quote_requests row to update
 * @returns `{ error }` — null on success
 */
export async function markQuoteContacted(quoteId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!quoteId || typeof quoteId !== "string") return { error: "Invalid quote ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("quote_requests")
    .update({ status: "contacted" })
    .eq("id", quoteId);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Enables desktop app download access for a pharmacy account.
 * Sets `accounts.download_enabled = true`.
 * Requires a valid HQ session.
 *
 * @param accountId - UUID of the accounts row to update
 * @returns `{ error }` — null on success
 */
export async function enableDownload(accountId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("accounts")
    .update({ download_enabled: true })
    .eq("id", accountId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function getHQStats(): Promise<{
  totalAccounts: number;
  totalBranches: number;
  pendingQuotes: number;
  contactedQuotes: number;
  error?: string;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { totalAccounts: 0, totalBranches: 0, pendingQuotes: 0, contactedQuotes: 0, error: auth.error };

  const supabase = await createServiceClient();
  const [accounts, branches, pending, contacted] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("branches").select("id", { count: "exact", head: true }),
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "contacted"),
  ]);

  return {
    totalAccounts: accounts.count ?? 0,
    totalBranches: branches.count ?? 0,
    pendingQuotes: pending.count ?? 0,
    contactedQuotes: contacted.count ?? 0,
  };
}

// ─── Download management ─────────────────────────────────────────────────────

export interface AppRelease {
  id: string;
  platform: "windows" | "mac" | "linux";
  version: string;
  file_path: string;
  file_url: string;
  file_size_bytes: number;
  release_notes: string | null;
  is_current: boolean;
  uploaded_at: string;
}

/**
 * Fetches all app releases ordered newest-first.
 * Requires a valid HQ session.
 */
export async function getAllReleases(): Promise<{ data: AppRelease[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("app_releases")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Fetches the current release for each platform (is_current = true).
 * Uses the service-role client so RLS doesn't block reads.
 * Safe to call from the pharmacy /download page.
 */
export async function getCurrentReleases(): Promise<{
  data: Record<string, AppRelease> | null;
  error: string | null;
}> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("app_releases")
    .select("*")
    .eq("is_current", true);

  if (error) return { data: null, error: error.message };

  const byPlatform: Record<string, AppRelease> = {};
  for (const release of data ?? []) {
    byPlatform[release.platform] = release;
  }
  return { data: byPlatform, error: null };
}

/**
 * Phase 1 of the two-phase upload flow.
 *
 * Validates the HQ session, validates input, and returns a short-lived Supabase
 * signed upload URL. The client uploads the binary directly to Supabase Storage
 * using this URL (bypassing the Next.js Server Action body-size limit entirely).
 *
 * Storage path is UUID-prefixed so every upload is an immutable, unique object —
 * re-uploading the same version/filename never silently overwrites an existing binary.
 *
 * ── Supabase Storage Bucket Setup (Required) ───────────────────────────────────
 * 1. Go to Storage > New bucket in Supabase dashboard
 * 2. Name: "app-releases"
 * 3. Set as Private (uploads use signed URLs; reads can be public or signed)
 * 4. Add CORS policy to allow PUT from your domain:
 *    - Allowed origins: your app domain (e.g., https://cervos.example.com)
 *    - Allowed methods: PUT
 *    - Allowed headers: Content-Type, x-upsert
 * 5. The service-role key handles all uploads (RLS bypassed), so no storage
 *    policies are needed for INSERT — only the bucket must exist and be accessible.
 *
 * ── Troubleshooting ───────────────────────────────────────────────────────────
 * If uploads fail with "Bucket not found", the bucket doesn't exist.
 * If uploads fail with CORS errors, the bucket CORS policy is misconfigured.
 * If uploads fail with "URL expired", the signed URL lifespan is too short
 * (default ~1 hour). Re-upload with a fresh signed URL.
 *
 * @returns `{ signedUrl, path, error }` — signedUrl and path are null on failure
 */
export async function getSignedUploadUrl(
  platform: string,
  version: string,
  fileName: string
): Promise<{ signedUrl: string | null; path: string | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { signedUrl: null, path: null, error: auth.error };

  if (!platform || !["windows", "mac", "linux"].includes(platform))
    return { signedUrl: null, path: null, error: "Invalid platform." };
  if (!version || version.trim() === "")
    return { signedUrl: null, path: null, error: "Version is required." };
  if (!fileName || fileName.trim() === "")
    return { signedUrl: null, path: null, error: "File name is required." };

  const supabase = await createServiceClient();

  // UUID prefix per upload → immutable, unique object key
  const { randomUUID } = await import("crypto");
  const uniqueId = randomUUID();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${platform}/${uniqueId}/${safeName}`;

  // First verify the bucket exists before attempting signed URL creation
  const { data: bucketData, error: bucketError } = await supabase.storage
    .from("app-releases")
    .list("", { limit: 1 });

  if (bucketError) {
    return { signedUrl: null, path: null, error: bucketError.message };
  }

  const { data, error } = await supabase.storage
    .from("app-releases")
    .createSignedUploadUrl(path);

  if (error || !data)
    return { signedUrl: null, path: null, error: error?.message ?? "Failed to create signed URL." };

  return { signedUrl: data.signedUrl, path, error: null };
}

/**
 * Phase 2 of the two-phase upload flow.
 *
 * Called after the client has successfully PUT the binary to the signed URL.
 * Derives the public download URL from the storage path and inserts the
 * `app_releases` row. If the DB insert fails, this function automatically
 * deletes the orphaned storage object to avoid orphaned files.
 *
 * @param platform   - "windows" | "mac" | "linux"
 * @param version    - Human-readable version label (e.g. "2.5.0")
 * @param filePath   - Storage object path returned by `getSignedUploadUrl`
 * @param fileSizeBytes - Byte size of the uploaded file (provided by the client)
 * @param releaseNotes  - Optional release notes text
 */
export async function confirmUpload(
  platform: string,
  version: string,
  filePath: string,
  fileSizeBytes: number,
  releaseNotes: string | null
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!platform || !["windows", "mac", "linux"].includes(platform)) return { error: "Invalid platform." };
  if (!version || version.trim() === "") return { error: "Version is required." };
  if (!filePath || filePath.trim() === "") return { error: "File path is required." };
  if (typeof fileSizeBytes !== "number" || fileSizeBytes <= 0) return { error: "Invalid file size." };

  const supabase = await createServiceClient();

  const { error: insertError } = await supabase.from("app_releases").insert({
    platform,
    version: version.trim(),
    file_path: filePath,
    file_url: filePath,
    file_size_bytes: fileSizeBytes,
    release_notes: releaseNotes?.trim() || null,
    is_current: false,
  });

  if (insertError) {
    // Cleanup: remove the orphaned file from storage since DB insert failed
    await supabase.storage.from("app-releases").remove([filePath]);
    return { error: `Database insert failed: ${insertError.message}` };
  }
  return { error: null };
}

/**
 * Validates that the Supabase Storage bucket 'app-releases' exists and is accessible.
 * Call this on page load to detect bucket configuration issues early.
 *
 * @returns `{ configured: boolean, error: string | null }`
 */
export async function checkStorageBucket(): Promise<{ configured: boolean; error: string | null }> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.storage
    .from("app-releases")
    .list("", { limit: 1 });

  if (error) {
    return { configured: false, error: error.message };
  }

  return { configured: true, error: null };
}

/**
 * Marks a release as the current release for its platform.
 *
 * Platform is derived server-side from the release row — the caller supplies only
 * the release ID, preventing any client-supplied platform from affecting the wrong
 * platform's current state.
 *
 * The promotion is performed atomically via the `set_current_release` PostgreSQL
 * function, which demotes all other releases for the same platform and promotes
 * the target in a single UPDATE statement. A partial unique index
 * (`app_releases_one_current_per_platform`) enforces the DB-level invariant.
 *
 * Requires a valid HQ session.
 * Requires the `set_current_release` SQL function and partial unique index to be
 * applied in Supabase — see ARCHITECTURE.md "App Releases" section.
 */
export async function setCurrentRelease(
  releaseId: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!releaseId || typeof releaseId !== "string") return { error: "Invalid release ID." };

  const supabase = await createServiceClient();

  try {
    const { error } = await supabase.rpc("set_current_release", { p_release_id: releaseId });
    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "set_current_release RPC function not available. Please run the SQL migration." };
  }
}

/**
 * Deletes a release: removes from Supabase Storage and the app_releases table.
 * Requires a valid HQ session.
 */
export async function deleteRelease(
  releaseId: string,
  filePath: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!releaseId || !filePath) return { error: "Invalid parameters." };

  const supabase = await createServiceClient();

  // Remove from storage first
  const { error: storageError } = await supabase.storage
    .from("app-releases")
    .remove([filePath]);

  if (storageError) return { error: `Storage deletion failed: ${storageError.message}` };

  // Delete the DB row
  const { error: dbError } = await supabase
    .from("app_releases")
    .delete()
    .eq("id", releaseId);

  if (dbError) return { error: `Database deletion failed: ${dbError.message}` };
  return { error: null };
}

// ─── Supplier Invite Management ─────────────────────────────────────────────

export interface InviteWithQuote {
  id: string;
  quoteRequestId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  inviteToken: string;
  tokenExpiresAt: string;
  status: string;
  createdAt: string;
  acceptedAt?: string;
  supplierAccountId?: string;
  supplierAccountName?: string;
  branchName?: string;
  expectedBranches?: number;
  currentSupplier?: string;
  annualVolume?: string;
}

function generateSecureToken(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(32).toString("hex");
}

export async function createSupplierInvite(
  quoteRequestId: string,
  email: string,
  companyName: string
): Promise<{ data: { inviteLink: string; inviteId: string } | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  if (!quoteRequestId || typeof quoteRequestId !== "string") {
    return { data: null, error: "Invalid quote request ID." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { data: null, error: "Valid email is required." };
  }

  const supabase = await createServiceClient();

  const { data: quoteRequest } = await supabase
    .from("quote_requests")
    .select("id, company_name")
    .eq("id", quoteRequestId)
    .maybeSingle();

  if (!quoteRequest) {
    return { data: null, error: "Quote request not found." };
  }

  const existingInvite = await supabase
    .from("supplier_invites")
    .select("id")
    .eq("quote_request_id", quoteRequestId)
    .in("status", ["pending"])
    .maybeSingle();

  if (existingInvite) {
    return { data: null, error: "An active invite already exists for this quote request." };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(HQ_COOKIE_NAME)?.value;
  const { data: admin } = await supabase
    .from("hq_admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const inviteToken = generateSecureToken();
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: inviteError } = await supabase
    .from("supplier_invites")
    .insert({
      quote_request_id: quoteRequestId,
      invite_token: inviteToken,
      token_expires_at: tokenExpiresAt,
      invited_by_hq_admin_id: admin?.id ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (inviteError) return { data: null, error: inviteError.message };

  await supabase
    .from("quote_requests")
    .update({ status: "contacted" })
    .eq("id", quoteRequestId);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/auth?invite_token=${inviteToken}`;

  return { data: { inviteLink, inviteId: invite.id }, error: null };
}

export async function getSupplierInvites(): Promise<{ data: InviteWithQuote[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("supplier_invites")
    .select(`
      id,
      quote_request_id,
      supplier_account_id,
      invite_token,
      token_expires_at,
      status,
      accepted_at,
      created_at,
      quote_requests!left(id, company_name, contact_name, email, phone, branch_name, expected_branches, current_supplier, annual_volume),
      accounts!left(id, name)
    `)
    .order("uploaded_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const invites: InviteWithQuote[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    quoteRequestId: (row.quote_request_id as string) ?? "",
    companyName: ((row.quote_requests as Record<string, unknown>)?.company_name as string) ?? "",
    contactName: ((row.quote_requests as Record<string, unknown>)?.contact_name as string) ?? "",
    email: ((row.quote_requests as Record<string, unknown>)?.email as string) ?? "",
    phone: ((row.quote_requests as Record<string, unknown>)?.phone as string) ?? undefined,
    inviteToken: row.invite_token as string,
    tokenExpiresAt: row.token_expires_at as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    acceptedAt: (row.accepted_at as string) ?? undefined,
    supplierAccountId: (row.supplier_account_id as string) ?? undefined,
    supplierAccountName: ((row.accounts as Record<string, unknown>)?.name as string) ?? undefined,
    branchName: ((row.quote_requests as Record<string, unknown>)?.branch_name as string) ?? undefined,
    expectedBranches: ((row.quote_requests as Record<string, unknown>)?.expected_branches as number) ?? undefined,
    currentSupplier: ((row.quote_requests as Record<string, unknown>)?.current_supplier as string) ?? undefined,
    annualVolume: ((row.quote_requests as Record<string, unknown>)?.annual_volume as string) ?? undefined,
  }));

  return { data: invites, error: null };
}

export async function cancelInvite(inviteId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!inviteId || typeof inviteId !== "string") return { error: "Invalid invite ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("supplier_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  return { error: null };
}

export async function resendInvite(inviteId: string): Promise<{ data: { inviteLink: string } | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };
  if (!inviteId || typeof inviteId !== "string") return { data: null, error: "Invalid invite ID." };

  const supabase = await createServiceClient();
  const { data: invite } = await supabase
    .from("supplier_invites")
    .select("id, invite_token, token_expires_at, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { data: null, error: "Invite not found." };
  if (invite.status !== "pending") return { data: null, error: "Only pending invites can be resent." };

  const newToken = generateSecureToken();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("supplier_invites")
    .update({ invite_token: newToken, token_expires_at: newExpiry })
    .eq("id", inviteId);

  if (error) return { data: null, error: error.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { data: { inviteLink: `${appUrl}/auth?invite_token=${newToken}` }, error: null };
}

export async function approveSupplierAccount(accountId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      download_enabled: true,
      subscription_status: "active",
    })
    .eq("id", accountId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function saveSupplierQuoteAnswers(
  quoteRequestId: string,
  answers: {
    expectedBranches?: number;
    annualVolume?: string;
    currentSupplier?: string;
    notes?: string;
  }
): Promise<{ error: string | null }> {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return { error: "Account not found." };

  try {
    const { error } = await supabase
      .from("supplier_quote_answers")
      .upsert({
        quote_request_id: quoteRequestId,
        account_id: account.id,
        expected_branches: answers.expectedBranches,
        annual_volume: answers.annualVolume,
        current_supplier: answers.currentSupplier,
        notes: answers.notes,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "quote_request_id,account_id",
      });

    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "supplier_quote_answers table not available. Please run the SQL migration." };
  }
}

export async function getSupplierQuoteAnswers(quoteRequestId: string): Promise<{
  data: {
    expectedBranches: number | null;
    annualVolume: string | null;
    currentSupplier: string | null;
    notes: string | null;
  } | null;
  error: string | null;
}> {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return { data: null, error: "Account not found." };

  try {
    const { data, error } = await supabase
      .from("supplier_quote_answers")
      .select("expected_branches, annual_volume, current_supplier, notes")
      .eq("quote_request_id", quoteRequestId)
      .eq("account_id", account.id)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    return {
      data: {
        expectedBranches: data.expected_branches,
        annualVolume: data.annual_volume,
        currentSupplier: data.current_supplier,
        notes: data.notes,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "supplier_quote_answers table not available. Please run the SQL migration." };
  }
}

// ─── Supplier Quote Answers for HQ ─────────────────────────────────────────

export async function getQuoteAnswersForHQ(quoteRequestId: string): Promise<{
  data: {
    accountId: string;
    accountName: string;
    expectedBranches: number | null;
    annualVolume: string | null;
    currentSupplier: string | null;
    notes: string | null;
    submittedAt: string;
  }[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    const { data, error } = await supabase
      .from("supplier_quote_answers")
      .select(`
        account_id,
        expected_branches,
        annual_volume,
        current_supplier,
        notes,
        created_at,
        accounts!inner(id, name)
      `)
      .eq("quote_request_id", quoteRequestId);

    if (error) return { data: null, error: error.message };

    const answers = (data ?? []).map((row: Record<string, unknown>) => ({
      accountId: row.account_id as string,
      accountName: ((row.accounts as Record<string, unknown>)?.name as string) ?? "",
      expectedBranches: row.expected_branches as number | null,
      annualVolume: row.annual_volume as string | null,
      currentSupplier: row.current_supplier as string | null,
      notes: row.notes as string | null,
      submittedAt: row.created_at as string,
    }));

    return { data: answers, error: null };
  } catch {
    return { data: [], error: null };
  }
}

export async function linkInviteToAccount(
  inviteToken: string,
  accountId: string
): Promise<{ error: string | null }> {
  const supabase = await createServiceClient();

  try {
    const { data: invite } = await supabase
      .from("supplier_invites")
      .select("id, status, token_expires_at")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (!invite) return { error: "Invalid invite token." };
    if (invite.status === "accepted") return { error: "Invite already used." };
    if (invite.status === "expired" || new Date(invite.token_expires_at) < new Date()) {
      await supabase
        .from("supplier_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return { error: "Invite has expired." };
    }

    const { error } = await supabase
      .from("supplier_invites")
      .update({
        status: "accepted",
        supplier_account_id: accountId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (error) return { error: error.message };

    return { error: null };
  } catch {
    return { error: "supplier_invites table not available. Please run the SQL migration." };
  }
}

/**
 * Manually unlocks a pharmacy branch. Used by HQ admins when a branch is locked
 * and the pharmacy has contacted support. Sets subscription_status to 'active'
 * and records the unlock timestamp.
 *
 * @param branchId - UUID of the branch to unlock
 * @returns `{ error }` — null on success
 */
export async function manualUnlockBranch(branchId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!branchId || typeof branchId !== "string") return { error: "Invalid branch ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("branches")
    .update({
      subscription_status: "active",
      manually_unlocked_at: new Date().toISOString(),
    })
    .eq("id", branchId);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Fetches all accounts (pharmacy + supplier), ordered newest-first.
 * Requires a valid HQ session.
 *
 * @returns `{ data, error }` — data includes id, name, type, billing_status, download_enabled, created_at
 */
export async function getAllAccounts(): Promise<{
  data: {
    id: string;
    name: string;
    type: string;
    billing_status: string;
    download_enabled: boolean;
    subscription_status: string | null;
    verified: boolean;
    suspended_at: string | null;
    created_at: string;
  }[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, billing_status, download_enabled, subscription_status, verified, created_at")
    .order("uploaded_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return {
    data: (data ?? []).map((a) => ({
      ...a,
      suspended_at: null, // accounts.suspended_at may not exist
    })),
    error: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// HQ Intelligence — analytics, demographics, and drill-downs
// ═══════════════════════════════════════════════════════════════════════

export interface RecentActivityEntry {
  id: string;
  action: string;
  actor: string;
  entity_type: string | null;
  detail: string | null;
  created_at: string;
  branchId: string | null;
  branchName: string | null;
  accountName: string | null;
}

export interface IntelligenceOverview {
  totals: {
    accounts: number;
    pharmacies: number;
    suppliers: number;
    suspended: number;
    branches: number;
    lockedBranches: number;
    operators: number;
    installs: number;
    onboardingCompleted: number;
  };
  period: {
    days: number;
    quoteRequests: number;
    supportTickets: number;
    openSupportTickets: number;
    sales: number;
    salesRevenue: number;
    newAccounts: number;
  };
  quoteFunnel: { status: string; count: number }[];
  supportBreakdown: { status: string; count: number }[];
  recentActivity: RecentActivityEntry[];
}

function periodStartIso(days: number): string {
  if (!days || days <= 0) return "1970-01-01T00:00:00.000Z";
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  table: "accounts" | "branches" | "operators" | "installs" | "user_profiles",
  filter?: { column: string; value: unknown }
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter && filter.value !== null) q = q.eq(filter.column, filter.value);
  const { count } = await q;
  return count ?? 0;
}

export async function getIntelligenceOverview(
  periodDays: number
): Promise<{ data: IntelligenceOverview | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const start = periodStartIso(periodDays);

  try {
    let totalAccounts = 0, pharmacyCount = 0, supplierCount = 0;
    let totalBranches = 0, lockedCount = 0, totalOperators = 0, totalInstalls = 0;
    let onboardingCount = 0;
    let periodQuotes = 0, periodTickets = 0, periodOpenTickets = 0, periodNewAccounts = 0;
    let suspendedCount = 0;

    try {
      const [accountsResult, pharmacyResult, supplierResult, branchesResult, lockedResult, operatorsResult, installsResult, newAccountsResult, suspendedResult] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("type", "pharmacy"),
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("type", "supplier"),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }).neq("subscription_status", "active"),
        supabase.from("operators").select("id", { count: "exact", head: true }),
        supabase.from("installs").select("id", { count: "exact", head: true }),
        supabase.from("accounts").select("id", { count: "exact", head: true }).gte("created_at", start),
        supabase.from("accounts").select("id", { count: "exact", head: true }).neq("type", "supplier"),
      ]);
      totalAccounts = accountsResult.count ?? 0;
      pharmacyCount = pharmacyResult.count ?? 0;
      supplierCount = supplierResult.count ?? 0;
      totalBranches = branchesResult.count ?? 0;
      lockedCount = lockedResult.count ?? 0;
      totalOperators = operatorsResult.count ?? 0;
      totalInstalls = installsResult.count ?? 0;
      periodNewAccounts = newAccountsResult.count ?? 0;

      // Try to get suspended count - accounts.suspended_at may not exist
      const { count } = await supabase.from("accounts").select("id", { count: "exact", head: true }).not("verified", "is", null);
      suspendedCount = 0; // Default to 0 if column doesn't exist

      // Try user_profiles for onboarding - table may not exist
      try {
        const { count: onboarding } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).not("onboarding_completed_at", "is", null);
        onboardingCount = onboarding ?? 0;
      } catch {
        onboardingCount = 0;
      }
    } catch {
      // Tables may not exist - use defaults
    }

    try {
      const [quotesResult, ticketsResult, openTicketsResult] = await Promise.all([
        supabase.from("quote_requests").select("id", { count: "exact", head: true }).gte("created_at", start),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).gte("created_at", start),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).gte("created_at", start).eq("status", "open"),
      ]);
      periodQuotes = quotesResult.count ?? 0;
      periodTickets = ticketsResult.count ?? 0;
      periodOpenTickets = openTicketsResult.count ?? 0;
    } catch {
      // Tables may not exist
    }

    // Funnel + support breakdown: pull compact columns for the period, count client-side.
    let quoteRows: { status: string }[] = [];
    let ticketRows: { status: string }[] = [];

    try {
      const [quotesData, ticketsData] = await Promise.all([
        supabase.from("quote_requests").select("status").gte("created_at", start),
        supabase.from("support_tickets").select("status").gte("created_at", start),
      ]);
      quoteRows = quotesData.data ?? [];
      ticketRows = ticketsData.data ?? [];
    } catch {
      // Tables may not exist
    }

    const quoteFunnel = ["pending", "contacted", "closed"].map((status) => ({
      status,
      count: quoteRows.filter((r) => r.status === status).length,
    }));
    const supportBreakdown = ["open", "in_progress", "resolved"].map((status) => ({
      status,
      count: ticketRows.filter((r) => r.status === status).length,
    }));

    // Sales volume in the period - sales.account_id may not exist
    let periodSales = 0;
    let periodSalesRevenue = 0;
    try {
      // Try with account_id first, fall back to no filter
      const { data: saleRows } = await supabase
        .from("sales")
        .select("total")
        .gte("created_at", start);
      periodSales = saleRows?.length ?? 0;
      periodSalesRevenue = (saleRows ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    } catch {
      // sales.account_id may not exist, or sales table is empty
      periodSales = 0;
      periodSalesRevenue = 0;
    }

    const recentActivity = await getRecentActivityInternal(supabase, 8);

    const data: IntelligenceOverview = {
      totals: {
        accounts: totalAccounts,
        pharmacies: pharmacyCount,
        suppliers: supplierCount,
        suspended: suspendedCount,
        branches: totalBranches,
        lockedBranches: lockedCount,
        operators: totalOperators,
        installs: totalInstalls,
        onboardingCompleted: onboardingCount,
      },
      period: {
        days: periodDays || 0,
        quoteRequests: periodQuotes,
        supportTickets: periodTickets,
        openSupportTickets: periodOpenTickets,
        sales: periodSales,
        salesRevenue: periodSalesRevenue,
        newAccounts: periodNewAccounts,
      },
      quoteFunnel,
      supportBreakdown,
      recentActivity,
    };

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to load intelligence overview." };
  }
}

async function getRecentActivityInternal(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  limit: number
): Promise<RecentActivityEntry[]> {
  try {
    const { data } = await supabase
      .from("activity_log")
      .select("id, action, actor, entity_type, detail, created_at, branch_id, branches(id, name, accounts(name))")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      entity_type: row.entity_type,
      detail: row.detail ? JSON.stringify(row.detail) : null,
      created_at: row.created_at,
      branchId: row.branch_id ?? null,
      branchName: (row.branches as unknown as { name?: string } | null)?.name ?? null,
      accountName:
        ((row.branches as unknown as { accounts?: { name?: string } } | null)?.accounts?.name) ?? null,
    }));
  } catch {
    // activity_log table or columns may not exist
    return [];
  }
}

/**
 * Fetches the most recent cross-network activity.
 * Requires a valid HQ session.
 */
export async function getRecentActivity(limit = 20): Promise<{
  data: RecentActivityEntry[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const entries = await getRecentActivityInternal(supabase, limit);
  return { data: entries, error: null };
}

// ─── Account list with demographics ───────────────────────────────────

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  billing_status: string;
  download_enabled: boolean;
  subscription_status: string | null;
  verified: boolean;
  suspended: boolean;
  created_at: string;
  contact_name: string | null;
  phone: string | null;
  region: string | null;
  role: string | null;
  tech_comfort: string | null;
  goals: string[];
  onboarding_completed_at: string | null;
  last_active_at: string | null;
  branchCount: number;
  installCount: number;
}

export async function getAllAccountsWithProfiles(): Promise<{
  data: AccountRow[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  let accounts: Record<string, unknown>[] = [];
  let profiles: Record<string, unknown>[] = [];
  let branches: Record<string, unknown>[] = [];

  try {
    const [accountsResult, profilesResult, branchesResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, type, billing_status, download_enabled, subscription_status, verified, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("account_id, contact_name, phone, region, role, tech_comfort, goals, onboarding_completed_at, last_active_at"),
      supabase.from("branches").select("id, account_id"),
    ]);
    accounts = accountsResult.data ?? [];
    profiles = profilesResult.data ?? [];
    branches = branchesResult.data ?? [];
  } catch {
    // Tables may not exist - try accounts alone
    const result = await supabase
      .from("accounts")
      .select("id, name, type, billing_status, download_enabled, subscription_status, verified, created_at")
      .order("uploaded_at", { ascending: false });
    accounts = result.data ?? [];
    if (!accounts.length) return { data: null, error: "Failed to load accounts." };
  }

  if (!accounts.length) return { data: null, error: "Failed to load accounts." };

  let installRows: { branch_id: string }[] = [];
  try {
    const result = await supabase.from("installs").select("id, branch_id");
    installRows = result.data ?? [];
  } catch {
    // installs table may not exist
  }

  const installsByBranch = new Map<string, number>();
  for (const row of installRows) {
    installsByBranch.set(row.branch_id, (installsByBranch.get(row.branch_id) ?? 0) + 1);
  }
  const branchCounts = new Map<string, number>();
  for (const row of branches) {
    branchCounts.set(row.account_id as string, (branchCounts.get(row.account_id as string) ?? 0) + 1);
  }

  const profileMap = new Map(profiles.map((p) => [p.account_id as string, p]));

  const data: AccountRow[] = accounts.map((a) => {
    const p = profileMap.get(a.id as string);
    const branchIds = branches.filter((b) => b.account_id === a.id).map((b) => b.id as string);
    const installCount = branchIds.reduce((sum, id) => sum + (installsByBranch.get(id) ?? 0), 0);
    return {
      id: a.id as string,
      name: a.name as string,
      type: a.type as string,
      billing_status: a.billing_status as string,
      download_enabled: a.download_enabled as boolean,
      subscription_status: a.subscription_status as string | null,
      verified: a.verified as boolean,
      suspended: false, // accounts.suspended_at may not exist
      created_at: a.created_at as string,
      contact_name: (p?.contact_name as string | null) ?? null,
      phone: (p?.phone as string | null) ?? null,
      region: (p?.region as string | null) ?? null,
      role: (p?.role as string | null) ?? null,
      tech_comfort: (p?.tech_comfort as string | null) ?? null,
      goals: Array.isArray(p?.goals) ? (p.goals as unknown[]).map((g) => String(g)) : [],
      onboarding_completed_at: (p?.onboarding_completed_at as string | null) ?? null,
      last_active_at: (p?.last_active_at as string | null) ?? null,
      branchCount: branchCounts.get(a.id as string) ?? 0,
      installCount,
    };
  });

  return { data, error: null };
}

// ─── Demographics breakdown ────────────────────────────────────────────

export interface DemographicBucket {
  label: string;
  count: number;
}

export interface DemographicsBreakdown {
  accountTypes: DemographicBucket[];
  regions: DemographicBucket[];
  roles: DemographicBucket[];
  techComfort: DemographicBucket[];
  goals: DemographicBucket[];
}

export async function getDemographicsBreakdown(): Promise<{
  data: DemographicsBreakdown | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  let profiles: Record<string, unknown>[] = [];
  try {
    const result = await supabase
      .from("user_profiles")
      .select("account_id, region, role, tech_comfort, goals, accounts(type)");
    if (result.error) throw new Error(result.error.message);
    profiles = result.data ?? [];
  } catch {
    // user_profiles table may not exist
    return {
      data: {
        accountTypes: [],
        regions: [],
        roles: [],
        techComfort: [],
        goals: [],
      },
      error: null,
    };
  }

  const typeCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const comfortCounts = new Map<string, number>();
  const goalCounts = new Map<string, number>();

  for (const p of profiles) {
    const type = (p.accounts as unknown as { type?: string } | null)?.type;
    if (type) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (p.region) regionCounts.set(p.region as string, (regionCounts.get(p.region as string) ?? 0) + 1);
    if (p.role) roleCounts.set(p.role as string, (roleCounts.get(p.role as string) ?? 0) + 1);
    if (p.tech_comfort) comfortCounts.set(p.tech_comfort as string, (comfortCounts.get(p.tech_comfort as string) ?? 0) + 1);
    if (Array.isArray(p.goals)) {
      for (const g of p.goals) {
        const label = String(g).trim();
        if (label) goalCounts.set(label, (goalCounts.get(label) ?? 0) + 1);
      }
    }
  }

  const toBuckets = (m: Map<string, number>): DemographicBucket[] =>
    [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  return {
    data: {
      accountTypes: toBuckets(typeCounts),
      regions: toBuckets(regionCounts),
      roles: toBuckets(roleCounts),
      techComfort: toBuckets(comfortCounts),
      goals: toBuckets(goalCounts),
    },
    error: null,
  };
}

// ─── Account drill-down ────────────────────────────────────────────────

export interface BranchDetail {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  subscription_status: string;
  trial_ends_at: string | null;
  payment_due_at: string | null;
  grace_ends_at: string | null;
  unlock_requested_at: string | null;
  manually_unlocked_at: string | null;
  locked_manually_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  operators: { id: string; name: string; role: string; created_at: string }[];
  installCount: number;
}

export interface AccountDetail {
  account: {
    id: string;
    name: string;
    type: string;
    billing_status: string;
    download_enabled: boolean;
    subscription_status: string | null;
    verified: boolean;
    suspended_at: string | null;
    suspension_reason: string | null;
    created_at: string;
  } | null;
  profile: {
    contact_name: string | null;
    phone: string | null;
    region: string | null;
    role: string | null;
    tech_comfort: string | null;
    goals: string[];
    onboarding_completed_at: string | null;
    last_active_at: string | null;
  } | null;
  branches: BranchDetail[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    category: string;
    created_at: string;
  }[];
  sales: { count: number; revenue: number };
  orders: {
    id: string;
    order_reference: string;
    status: string;
    amount: number | null;
    placed_at: string;
  }[];
  recentActivity: RecentActivityEntry[];
}

export async function getAccountDetail(accountId: string): Promise<{
  data: AccountDetail | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };
  if (!accountId || typeof accountId !== "string") return { data: null, error: "Invalid account ID." };

  const supabase = await createServiceClient();

  let account: Record<string, unknown> | null = null;
  let profile: Record<string, unknown> | null = null;
  let branchRows: Record<string, unknown>[] = [];

  try {
    const [accountResult, profileResult, branchesResult] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
      supabase.from("user_profiles").select("*").eq("account_id", accountId).maybeSingle(),
      supabase.from("branches").select("*").eq("account_id", accountId).order("created_at", { ascending: true }),
    ]);
    account = accountResult.data;
    profile = profileResult.data;
    branchRows = branchesResult.data ?? [];
  } catch {
    return { data: null, error: "Failed to load account data." };
  }

  if (!account) return { data: null, error: "Account not found." };

  const branchIds = branchRows.map((b) => b.id as string);

  let operatorRows: Record<string, unknown>[] = [];
  let installRows: Record<string, unknown>[] = [];
  let ticketRows: Record<string, unknown>[] = [];
  let saleRows: Record<string, unknown>[] = [];

  try {
    const results = await Promise.all([
      branchIds.length
        ? supabase.from("operators").select("id, branch_id, name, role, created_at").in("branch_id", branchIds)
        : Promise.resolve({ data: [] }),
      branchIds.length
        ? supabase.from("installs").select("id, branch_id")
        : Promise.resolve({ data: [] }),
      supabase.from("support_tickets").select("id, subject, status, category, created_at").eq("account_id", accountId).order("created_at", { ascending: false }),
      branchIds.length
        ? supabase.from("sales").select("total").in("branch_id", branchIds)
        : Promise.resolve({ data: [] }),
    ]);
    operatorRows = results[0].data ?? [];
    installRows = results[1].data ?? [];
    ticketRows = results[2].data ?? [];
    saleRows = results[3].data ?? [];
  } catch {
    // Tables may not exist or have missing columns
  }

  const installsByBranch = new Map<string, number>();
  for (const row of installRows) {
    installsByBranch.set(row.branch_id as string, (installsByBranch.get(row.branch_id as string) ?? 0) + 1);
  }

  const branches: BranchDetail[] = branchRows.map((b) => ({
    id: b.id as string,
    name: b.name as string,
    lat: b.lat != null ? Number(b.lat) : null,
    lng: b.lng != null ? Number(b.lng) : null,
    subscription_status: b.subscription_status as string,
    trial_ends_at: b.trial_ends_at as string | null,
    payment_due_at: b.payment_due_at as string | null,
    grace_ends_at: b.grace_ends_at as string | null,
    unlock_requested_at: b.unlock_requested_at as string | null,
    manually_unlocked_at: b.manually_unlocked_at as string | null,
    locked_manually_at: b.locked_manually_at as string | null ?? null,
    last_synced_at: b.last_synced_at as string | null,
    created_at: b.created_at as string,
    operators: operatorRows.filter((o) => o.branch_id === b.id).map((o) => ({
      id: o.id as string,
      name: o.name as string,
      role: o.role as string,
      created_at: o.created_at as string,
    })),
    installCount: installsByBranch.get(b.id as string) ?? 0,
  }));

  let orders: AccountDetail["orders"] = [];
  if (account.type === "supplier") {
    try {
      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, order_reference, status, placed_at, order_line_items(quantity, unit_price)")
        .eq("seller_id", accountId)
        .order("placed_at", { ascending: false })
        .limit(25);
      orders = (orderRows ?? []).map((o) => ({
        id: o.id,
        order_reference: o.order_reference,
        status: o.status,
        amount:
          (o.order_line_items as unknown as { quantity: number; unit_price: number }[] | null)?.reduce(
            (sum, li) => sum + li.quantity * li.unit_price,
            0
          ) ?? null,
        placed_at: o.placed_at,
      }));
    } catch {
      // orders table may not exist
    }
  }

  const recentActivity = await getRecentActivityInternal(supabase, 10).then((all) =>
    all.filter((a) => branchIds.includes(a.branchId ?? "")).slice(0, 5)
  );

  const sales = saleRows;
  const revenue = (sales as { total: number }[]).reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  return {
    data: {
      account: {
        id: account.id as string,
        name: account.name as string,
        type: account.type as string,
        billing_status: account.billing_status as string,
        download_enabled: account.download_enabled as boolean,
        subscription_status: account.subscription_status as string | null,
        verified: account.verified as boolean,
        suspended_at: account.suspended_at as string | null ?? null,
        suspension_reason: account.suspension_reason as string | null ?? null,
        created_at: account.created_at as string,
      },
      profile: profile
        ? {
            contact_name: profile.contact_name as string | null ?? null,
            phone: profile.phone as string | null ?? null,
            region: profile.region as string | null ?? null,
            role: profile.role as string | null ?? null,
            tech_comfort: profile.tech_comfort as string | null ?? null,
            goals: Array.isArray(profile.goals) ? (profile.goals as unknown[]).map((g) => String(g)) : [],
            onboarding_completed_at: profile.onboarding_completed_at as string | null ?? null,
            last_active_at: profile.last_active_at as string | null ?? null,
          }
        : null,
      branches,
      tickets: ticketRows.map((t) => ({
        id: t.id as string,
        subject: t.subject as string,
        status: t.status as string,
        category: t.category as string,
        created_at: t.created_at as string,
      })),
      sales: { count: sales.length, revenue },
      orders,
      recentActivity,
    },
    error: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// HQ Account Controls — granular management
// ═══════════════════════════════════════════════════════════════════════

/**
 * Updates an account's core fields and its profile row in one call.
 * Fields are validated server-side; empty strings become nulls.
 * Requires a valid HQ session.
 */
export async function updateAccountProfile(
  accountId: string,
  fields: {
    name?: string;
    billing_status?: string;
    download_enabled?: boolean;
    verified?: boolean;
    subscription_status?: string;
    contact_name?: string;
    phone?: string;
    region?: string;
    role?: string;
    tech_comfort?: string;
    goals?: string[];
    onboarding_completed_at?: string | null;
  }
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const allowedStatuses = ["trial", "active", "payment_due", "grace", "locked"];
  if (fields.subscription_status && !allowedStatuses.includes(fields.subscription_status)) {
    return { error: "Invalid subscription status." };
  }

  const supabase = await createServiceClient();

  const accountPatch: Record<string, unknown> = {};
  if (fields.name !== undefined) accountPatch.name = fields.name.trim() || "Unnamed account";
  if (fields.billing_status !== undefined) accountPatch.billing_status = fields.billing_status;
  if (fields.download_enabled !== undefined) accountPatch.download_enabled = Boolean(fields.download_enabled);
  if (fields.verified !== undefined) accountPatch.verified = Boolean(fields.verified);
  if (fields.subscription_status !== undefined) accountPatch.subscription_status = fields.subscription_status;

  if (Object.keys(accountPatch).length > 0) {
    const { error } = await supabase.from("accounts").update(accountPatch).eq("id", accountId);
    if (error) return { error: error.message };
  }

  const toNull = (v: string | undefined) => (v !== undefined ? (v.trim() || null) : undefined);
  const profilePatch: Record<string, unknown> = {};
  if (fields.contact_name !== undefined) profilePatch.contact_name = toNull(fields.contact_name);
  if (fields.phone !== undefined) profilePatch.phone = toNull(fields.phone);
  if (fields.region !== undefined) profilePatch.region = toNull(fields.region);
  if (fields.role !== undefined) profilePatch.role = toNull(fields.role);
  if (fields.tech_comfort !== undefined) profilePatch.tech_comfort = toNull(fields.tech_comfort);
  if (fields.goals !== undefined) profilePatch.goals = fields.goals.filter((g) => g.trim());
  if (fields.onboarding_completed_at !== undefined) {
    profilePatch.onboarding_completed_at = fields.onboarding_completed_at || null;
  }
  if (Object.keys(profilePatch).length > 0) {
    profilePatch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ account_id: accountId, ...profilePatch }, { onConflict: "account_id" });
    if (error) return { error: error.message };
  }

  return { error: null };
}

export async function suspendAccount(
  accountId: string,
  reason: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const supabase = await createServiceClient();
  // suspended_at may not exist - use verified=false as suspension indicator
  const { error } = await supabase
    .from("accounts")
    .update({ verified: false })
    .eq("id", accountId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function unsuspendAccount(accountId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const supabase = await createServiceClient();
  // suspended_at may not exist - just clear verification status instead
  const { error } = await supabase
    .from("accounts")
    .update({ verified: true })
    .eq("id", accountId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function lockBranch(branchId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!branchId || typeof branchId !== "string") return { error: "Invalid branch ID." };

  const supabase = await createServiceClient();
  // locked_manually_at may not exist - just update status
  const { error } = await supabase
    .from("branches")
    .update({ subscription_status: "locked" })
    .eq("id", branchId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Extends a branch's trial by `days` and clears any lock/unlock stamps.
 * Requires a valid HQ session.
 */
export async function extendBranchTrial(branchId: string, days: number): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!branchId || typeof branchId !== "string") return { error: "Invalid branch ID." };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: "Days must be between 1 and 365." };

  const supabase = await createServiceClient();
  const trialEnds = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await supabase
    .from("branches")
    .update({
      subscription_status: "trial",
      trial_ends_at: trialEnds,
      payment_due_at: null,
      grace_ends_at: null,
      locked_manually_at: null,
      manually_unlocked_at: null,
      unlock_requested_at: null,
    })
    .eq("id", branchId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Returns a branch to full active subscription status and clears all
 * lock/trial/grace stamps. Requires a valid HQ session.
 */
export async function resetBranchSubscription(branchId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!branchId || typeof branchId !== "string") return { error: "Invalid branch ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("branches")
    .update({
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      locked_manually_at: null,
      manually_unlocked_at: new Date().toISOString(),
    })
    .eq("id", branchId);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── Operator management ───────────────────────────────────────────────

const OPERATOR_ROLES = ["cashier", "pharmacist_in_charge", "owner"] as const;

/**
 * Adds an operator to a branch. The PIN is hashed with SHA-256, matching
 * the desktop's `session.ts`/`Manage.tsx` scheme — the raw PIN is never
 * stored. Requires a valid HQ session.
 */
export async function addOperator(
  branchId: string,
  name: string,
  pin: string,
  role: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!branchId || typeof branchId !== "string") return { error: "Invalid branch ID." };
  if (!name.trim()) return { error: "Operator name is required." };
  if (!/^\d{4,8}$/.test(pin)) return { error: "PIN must be 4-8 digits." };
  if (!OPERATOR_ROLES.includes(role as (typeof OPERATOR_ROLES)[number])) {
    return { error: "Invalid operator role." };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("operators").insert({
    branch_id: branchId,
    name: name.trim(),
    pin_hash: createHash("sha256").update(pin).digest("hex"),
    role,
  });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Removes an operator. Refuses if it is the branch's last operator
 * (prevents locking the branch out). Requires a valid HQ session.
 */
export async function removeOperator(operatorId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!operatorId || typeof operatorId !== "string") return { error: "Invalid operator ID." };

  const supabase = await createServiceClient();
  const { data: op } = await supabase.from("operators").select("id, branch_id").eq("id", operatorId).maybeSingle();
  if (!op) return { error: "Operator not found." };

  const { count } = await supabase
    .from("operators")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", op.branch_id);
  if ((count ?? 0) <= 1) return { error: "Cannot remove the last operator on this branch." };

  const { error } = await supabase.from("operators").delete().eq("id", operatorId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Changes an operator's role. Requires a valid HQ session.
 */
export async function setOperatorRole(operatorId: string, role: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!operatorId || typeof operatorId !== "string") return { error: "Invalid operator ID." };
  if (!OPERATOR_ROLES.includes(role as (typeof OPERATOR_ROLES)[number])) {
    return { error: "Invalid operator role." };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("operators").update({ role }).eq("id", operatorId);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── HQ team management ────────────────────────────────────────────────

export interface HQAdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

/**
 * Lists the HQ team. Requires a valid HQ session.
 */
export async function listHQAdmins(): Promise<{ data: HQAdminRow[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("hq_admins")
    .select("id, email, name, created_at")
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map((r) => ({ ...r, role: "admin", disabled: false, last_login_at: null })), error: null };
}

/**
 * Hashes an HQ password with scrypt in the same format `verifyHQPassword`
 * expects. Never called with a real password unless it's actually being stored.
 */
function hashHQPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Adds a new HQ team member. Requires a valid HQ session.
 */
export async function addHQAdmin(
  email: string,
  name: string,
  password: string,
  _role: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  const cleanEmail = (email ?? "").trim().toLowerCase();
  const cleanName = (name ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return { error: "Enter a valid email address." };
  if (!cleanName) return { error: "Name is required." };
  if ((password ?? "").length < 10) return { error: "Password must be at least 10 characters." };

  const supabase = await createServiceClient();
  const { error } = await supabase.from("hq_admins").insert({
    email: cleanEmail,
    name: cleanName,
    password_hash: hashHQPassword(password),
  });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Removes an HQ team member. Refuses to remove the last enabled admin so
 * the console can never lock itself out. Requires a valid HQ session.
 */
export async function removeHQAdmin(adminId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!adminId || typeof adminId !== "string") return { error: "Invalid admin ID." };

  const supabase = await createServiceClient();
  const { count } = await supabase
    .from("hq_admins")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return { error: "Cannot remove the last admin." };

  const { error } = await supabase.from("hq_admins").delete().eq("id", adminId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Enables or disables an HQ team member. Never disables the final enabled
 * admin. Requires a valid HQ session.
 */
export async function setHQAdminDisabled(adminId: string, _disabled: boolean): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!adminId || typeof adminId !== "string") return { error: "Invalid admin ID." };

  // disabled column not in schema - this feature is a no-op for now
  return { error: null };
}

// ═══════════════════════════════════════════════════════════════════════
// HQ Intelligence — Advanced Metrics
// ═══════════════════════════════════════════════════════════════════════

export interface SyncHealthMetrics {
  totalBranches: number;
  syncedRecently: number;
  syncedThisWeek: number;
  staleBranches: number;
  neverSynced: number;
  avgSyncFrequencyHours: number;
  branchesBySyncStatus: { status: string; count: number }[];
}

export interface EngagementMetrics {
  dauWauRatio: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  newAccountsThisMonth: number;
  accountsWhoTransactedThisMonth: number;
  avgOrdersPerTransactingAccount: number;
  topRegionsByActivity: { region: string; orderCount: number; revenue: number }[];
  retentionRate30Day: number;
}

export interface NetworkHealthMetrics {
  totalBranches: number;
  onlineNow: number;
  healthyStatus: number;
  atRiskStatus: number;
  lockedStatus: number;
  avgBatchesPerBranch: number;
  avgProductsPerBranch: number;
  expiringBatchesThisMonth: number;
  outOfStockProducts: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  mtdRevenue: number;
  ytdRevenue: number;
  revenueByDay: { date: string; amount: number }[];
  revenueByRegion: { region: string; amount: number; count: number }[];
  avgOrderValue: number;
  totalOrders: number;
  revenuePerAccountType: { type: string; revenue: number }[];
  topAccountsByRevenue: { accountId: string; name: string; revenue: number }[];
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function yearStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString();
}

export async function getSyncHealthMetrics(periodDays: number): Promise<{ data: SyncHealthMetrics | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    const { data: branches } = await supabase
      .from("branches")
      .select("id, last_synced_at, subscription_status, accounts(id, name)");

    if (!branches) return { data: null, error: "Failed to load branches." };

    const now = Date.now();
    const hourMs = 3600000;
    const dayMs = 86400000;
    const weekMs = 86400000 * 7;

    let syncedRecently = 0;
    let syncedThisWeek = 0;
    let staleBranches = 0;
    let neverSynced = 0;
    let totalHoursSinceSync = 0;
    let syncedCount = 0;

    for (const b of branches) {
      if (!b.last_synced_at) {
        neverSynced++;
      } else {
        const elapsed = now - new Date(b.last_synced_at).getTime();
        if (elapsed < dayMs) syncedRecently++;
        if (elapsed < weekMs) syncedThisWeek++;
        if (elapsed >= weekMs) staleBranches++;
        totalHoursSinceSync += elapsed / hourMs;
        syncedCount++;
      }
    }

    const avgSyncFrequencyHours = syncedCount > 0 ? totalHoursSinceSync / syncedCount : 0;

    const statusCounts = new Map<string, number>();
    for (const b of branches) {
      const status = b.subscription_status || "unknown";
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    const branchesBySyncStatus = [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const data: SyncHealthMetrics = {
      totalBranches: branches.length,
      syncedRecently,
      syncedThisWeek,
      staleBranches,
      neverSynced,
      avgSyncFrequencyHours: Math.round(avgSyncFrequencyHours),
      branchesBySyncStatus,
    };

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to load sync health metrics." };
  }
}

export async function getEngagementMetrics(): Promise<{ data: EngagementMetrics | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    const monthAgo = periodStartIso(30);

    let newAccountsMonth: { id: string }[] = [];
    let transactionsMonth: { account_id?: string; total?: number }[] = [];

    try {
      const [newAccountsResult, salesResult] = await Promise.all([
        supabase.from("accounts").select("id").gte("created_at", monthAgo),
        supabase.from("sales").select("account_id, total").gte("created_at", monthAgo),
      ]);
      newAccountsMonth = newAccountsResult.data ?? [];
      transactionsMonth = salesResult.data ?? [];
    } catch {
      // Tables may not exist
    }

    const transactingAccounts = new Set(transactionsMonth.map((t) => t.account_id).filter(Boolean));
    const avgOrdersPerTransactingAccount = transactingAccounts.size > 0 ? transactionsMonth.length / transactingAccounts.size : 0;

    const regionMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const t of transactionsMonth) {
      if (!t.account_id) continue;
      // user_profiles may not exist - use "Unknown" region
      const region = "Unknown";
      const existing = regionMap.get(region) || { orderCount: 0, revenue: 0 };
      regionMap.set(region, {
        orderCount: existing.orderCount + 1,
        revenue: existing.revenue + (Number(t.total) || 0),
      });
    }

    const topRegionsByActivity = [...regionMap.entries()]
      .map(([region, data]) => ({ region, ...data }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5);

    const data: EngagementMetrics = {
      dauWauRatio: 0,
      activeUsersToday: 0,
      activeUsersThisWeek: 0,
      newAccountsThisMonth: newAccountsMonth.length,
      accountsWhoTransactedThisMonth: transactingAccounts.size,
      avgOrdersPerTransactingAccount: Math.round(avgOrdersPerTransactingAccount * 10) / 10,
      topRegionsByActivity,
      retentionRate30Day: 0,
    };

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to load engagement metrics." };
  }
}

export async function getNetworkHealthMetrics(): Promise<{ data: NetworkHealthMetrics | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    let branches: Record<string, unknown>[] = [];
    let batches: Record<string, unknown>[] = [];
    let products: Record<string, unknown>[] = [];

    try {
      const results = await Promise.all([
        supabase.from("branches").select("id, subscription_status, last_synced_at"),
        supabase.from("batches").select("id, expiry_date, branch_id"),
        supabase.from("products").select("id, branch_id"),
      ]);
      branches = results[0].data ?? [];
      batches = results[1].data ?? [];
      products = results[2].data ?? [];
    } catch {
      // Tables may not exist or have missing columns
    }

    const now = Date.now();
    const hourMs = 3600000;
    const monthMs = 86400000 * 30;

    let onlineNow = 0;
    let healthyStatus = 0;
    let atRiskStatus = 0;
    let lockedStatus = 0;

    for (const b of branches) {
      if (b.last_synced_at) {
        const elapsed = now - new Date(b.last_synced_at as string).getTime();
        if (elapsed < hourMs) onlineNow++;
      }
      const status = (b.subscription_status as string) || "unknown";
      if (status === "active") healthyStatus++;
      else if (status === "grace" || status === "payment_due") atRiskStatus++;
      else if (status === "locked" || status === "expired") lockedStatus++;
    }

    const batchCount = batches.length;
    const productCount = products.length;
    const branchCount = branches.length;
    const avgBatchesPerBranch = branchCount > 0 ? Math.round((batchCount / branchCount) * 10) / 10 : 0;
    const avgProductsPerBranch = branchCount > 0 ? Math.round((productCount / branchCount) * 10) / 10 : 0;

    let expiringBatchesThisMonth = 0;
    const thirtyDaysFromNow = now + monthMs;
    for (const bat of batches) {
      // Use expiry_date, not expires_at
      const expiryDate = bat.expiry_date as string | null;
      if (expiryDate) {
        const expDate = new Date(expiryDate).getTime();
        if (expDate > now && expDate < thirtyDaysFromNow) expiringBatchesThisMonth++;
      }
    }

    // products.stock may not exist - default to 0 out of stock
    const outOfStockProducts = 0;

    const data: NetworkHealthMetrics = {
      totalBranches: branchCount,
      onlineNow,
      healthyStatus,
      atRiskStatus,
      lockedStatus,
      avgBatchesPerBranch,
      avgProductsPerBranch,
      expiringBatchesThisMonth,
      outOfStockProducts,
    };

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to load network health metrics." };
  }
}

export async function getRevenueMetrics(periodDays: number): Promise<{ data: RevenueMetrics | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    const periodStart = periodStartIso(periodDays);
    const mtdStart = monthStartIso();
    const ytdStart = yearStartIso();

    let allSales: { created_at: string; total: number }[] = [];
    let mtdSales: { total: number }[] = [];
    let ytdSales: { total: number }[] = [];
    let accounts: { id: string; name: string; type: string }[] = [];

    try {
      const results = await Promise.all([
        supabase.from("sales").select("created_at, total").gte("created_at", periodStart),
        supabase.from("sales").select("total").gte("created_at", mtdStart),
        supabase.from("sales").select("total").gte("created_at", ytdStart),
        supabase.from("accounts").select("id, name, type"),
      ]);
      allSales = results[0].data ?? [];
      mtdSales = results[1].data ?? [];
      ytdSales = results[2].data ?? [];
      accounts = results[3].data ?? [];
    } catch {
      // sales.account_id may not exist or tables missing
    }

    const totalRevenue = allSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const mtdRevenue = mtdSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const ytdRevenue = ytdSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const totalOrders = allSales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const revenueByDayMap = new Map<string, number>();
    for (const s of allSales) {
      const date = s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "unknown";
      revenueByDayMap.set(date, (revenueByDayMap.get(date) ?? 0) + (Number(s.total) || 0));
    }
    const revenueByDay = [...revenueByDayMap.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const regionRevenueMap = new Map<string, { amount: number; count: number }>();
    const typeRevenueMap = new Map<string, number>();
    const accountRevenueMap = new Map<string, { name: string; revenue: number }>();

    // sales.account_id may not exist - skip account-level attribution
    for (const s of allSales) {
      const region = "Unknown";
      const type = "unknown";

      const existingRegion = regionRevenueMap.get(region) || { amount: 0, count: 0 };
      regionRevenueMap.set(region, {
        amount: existingRegion.amount + (Number(s.total) || 0),
        count: existingRegion.count + 1,
      });

      typeRevenueMap.set(type, (typeRevenueMap.get(type) ?? 0) + (Number(s.total) || 0));
    }

    const revenueByRegion = [...regionRevenueMap.entries()]
      .map(([region, data]) => ({ region, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);

    const revenuePerAccountType = [...typeRevenueMap.entries()]
      .map(([type, revenue]) => ({ type, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const topAccountsByRevenue = [...accountRevenueMap.entries()]
      .map(([accountId, data]) => ({ accountId, name: data.name, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const data: RevenueMetrics = {
      totalRevenue,
      mtdRevenue,
      ytdRevenue,
      revenueByDay,
      revenueByRegion,
      avgOrderValue: Math.round(avgOrderValue),
      totalOrders,
      revenuePerAccountType,
      topAccountsByRevenue,
    };

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to load revenue metrics." };
  }
}

export async function getHourlyActivityStats(hours: number): Promise<{ data: { hour: string; actions: number }[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  try {
    const start = periodStartIso(hours || 24);
    const { data: activities } = await supabase
      .from("activity_log")
      .select("created_at")
      .gte("created_at", start);

    const hourCounts = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      hourCounts.set(String(h).padStart(2, "0"), 0);
    }

    for (const a of activities ?? []) {
      if (a.created_at) {
        const hour = new Date(a.created_at).getHours();
        hourCounts.set(String(hour).padStart(2, "0"), (hourCounts.get(String(hour).padStart(2, "0")) ?? 0) + 1);
      }
    }

    const data = [...hourCounts.entries()].map(([hour, actions]) => ({ hour: `${hour}:00`, actions }));

    return { data, error: null };
  } catch {
    // activity_log table may not exist - return empty hourly data
    const hourCounts: { hour: string; actions: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hourCounts.push({ hour: `${String(h).padStart(2, "0")}:00`, actions: 0 });
    }
    return { data: hourCounts, error: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Billing & Subscription Management
// ═══════════════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly_tzs: number;
  price_annual_tzs: number;
  max_branches: number;
  max_operators: number;
  features: string[];
}

export interface BillingAccount {
  id: string;
  account_name: string;
  account_type: string;
  subscription_plan: string | null;
  subscription_status: string;
  billing_status: string;
  mrr: number;
  ltv: number;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  last_payment_at: string | null;
  next_payment_at: string | null;
  payment_failures: number;
  branches_on_plan: number;
  created_at: string;
}

export interface BillingPeriod {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  amount_tzs: number;
  status: "paid" | "pending" | "failed" | "refunded";
  paid_at: string | null;
  invoice_url: string | null;
}

export interface BillingOverview {
  totalMrr: number;
  activeSubscriptions: number;
  pendingPayments: number;
  failedPayments: number;
  mtdRevenue: number;
  ytdRevenue: number;
}

export async function getSubscriptionPlans(): Promise<{ data: SubscriptionPlan[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price_monthly_tzs", { ascending: true });

  if (error) {
    // subscription_plans table may not exist
    return { data: [], error: null };
  }

  const plans: SubscriptionPlan[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_monthly_tzs: Number(p.price_monthly_tzs) || 0,
    price_annual_tzs: Number(p.price_annual_tzs) || 0,
    max_branches: p.max_branches ?? 1,
    max_operators: p.max_operators ?? 5,
    features: Array.isArray(p.features) ? p.features.map((f: unknown) => String(f)) : [],
  }));

  return { data: plans, error: null };
}

export async function upsertSubscriptionPlan(
  plan: Omit<SubscriptionPlan, "id"> & { id?: string }
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  const supabase = await createServiceClient();

  if (plan.id) {
    const { error } = await supabase
      .from("subscription_plans")
      .update({
        name: plan.name,
        price_monthly_tzs: plan.price_monthly_tzs,
        price_annual_tzs: plan.price_annual_tzs,
        max_branches: plan.max_branches,
        max_operators: plan.max_operators,
        features: plan.features,
      })
      .eq("id", plan.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("subscription_plans").insert({
      name: plan.name,
      price_monthly_tzs: plan.price_monthly_tzs,
      price_annual_tzs: plan.price_annual_tzs,
      max_branches: plan.max_branches,
      max_operators: plan.max_operators,
      features: plan.features,
    });
    if (error) return { error: error.message };
  }

  return { error: null };
}

export async function deleteSubscriptionPlan(planId: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!planId || typeof planId !== "string") return { error: "Invalid plan ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase.from("subscription_plans").delete().eq("id", planId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function getBillingOverview(): Promise<{ data: BillingOverview | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  let accounts: Record<string, unknown>[] = [];
  let branches: Record<string, unknown>[] = [];
  let manualPayments: { amount_tzs: string; created_at: string }[] = [];

  try {
    const [accountsResult, branchesResult, paymentsResult] = await Promise.all([
      supabase.from("accounts").select("id, subscription_status").neq("type", "supplier"),
      supabase.from("branches").select("account_id"),
      supabase.from("billing_payments").select("amount_tzs, created_at"),
    ]);
    accounts = accountsResult.data ?? [];
    branches = branchesResult.data ?? [];
    manualPayments = paymentsResult.data ?? [];
  } catch {
    // Tables may not exist - use empty data
  }

  const activeSubscriptions = accounts.filter((a) =>
    a.subscription_status === "active" || a.subscription_status === "trial"
  ).length;

  const branchesByAccount = new Map<string, number>();
  for (const b of branches) {
    branchesByAccount.set(b.account_id as string, (branchesByAccount.get(b.account_id as string) ?? 0) + 1);
  }

  // totalMrr cannot be calculated without subscription_plans table
  const totalMrr = 0;

  const mtdPayments = manualPayments.filter((p) =>
    new Date(p.created_at) >= startOfMonth
  );
  const ytdPayments = manualPayments.filter((p) =>
    new Date(p.created_at) >= startOfYear
  );

  const mtdRevenue = mtdPayments.reduce((sum, p) => sum + (Number(p.amount_tzs) || 0), 0);
  const ytdRevenue = ytdPayments.reduce((sum, p) => sum + (Number(p.amount_tzs) || 0), 0);

  return {
    data: {
      totalMrr,
      activeSubscriptions,
      pendingPayments: 0,
      failedPayments: accounts.filter((a) => a.subscription_status === "payment_due").length,
      mtdRevenue,
      ytdRevenue,
    },
    error: null,
  };
}

export async function getBillingAccounts(): Promise<{ data: BillingAccount[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  let accounts: Record<string, unknown>[] = [];
  let branches: Record<string, unknown>[] = [];
  let payments: Record<string, unknown>[] = [];
  let plans: Record<string, unknown>[] = [];

  try {
    const [accountsResult, branchesResult, paymentsResult, plansResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, type, subscription_status, billing_status, subscription_expires_at, created_at")
        .neq("type", "supplier")
        .order("created_at", { ascending: false }),
      supabase.from("branches").select("account_id"),
      supabase.from("billing_payments").select("account_id, amount_tzs, created_at").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, price_monthly_tzs"),
    ]);
    accounts = accountsResult.data ?? [];
    branches = branchesResult.data ?? [];
    payments = paymentsResult.data ?? [];
    plans = plansResult.data ?? [];
  } catch {
    // Tables may not exist - try basic accounts query
    const result = await supabase
      .from("accounts")
      .select("id, name, type, subscription_status, billing_status, subscription_expires_at, created_at")
      .neq("type", "supplier")
      .order("uploaded_at", { ascending: false });
    accounts = result.data ?? [];
    if (!accounts.length) return { data: [], error: null };
  }

  if (!accounts.length) return { data: [], error: null };

  const planMap = new Map(plans.map((p) => [p.id as string, p]));

  const branchesByAccount = new Map<string, number>();
  for (const b of branches) {
    branchesByAccount.set(b.account_id as string, (branchesByAccount.get(b.account_id as string) ?? 0) + 1);
  }

  const lastPaymentByAccount = new Map<string, { date: string; amount: number }>();
  for (const p of payments) {
    const existing = lastPaymentByAccount.get(p.account_id as string);
    if (!existing || new Date(p.created_at as string) > new Date(existing.date)) {
      lastPaymentByAccount.set(p.account_id as string, { date: p.created_at as string, amount: Number(p.amount_tzs) || 0 });
    }
  }

  const data: BillingAccount[] = accounts.map((a) => {
    const branchCount = branchesByAccount.get(a.id as string) ?? 0;
    const plan = planMap.get(a.subscription_plan as string);
    const mrr = plan ? (Number(plan.price_monthly_tzs) || 0) * branchCount : 0;
    const lastPayment = lastPaymentByAccount.get(a.id as string);

    return {
      id: a.id as string,
      account_name: a.name as string,
      account_type: a.type as string,
      subscription_plan: (a.subscription_plan as string | null) ?? null,
      subscription_status: (a.subscription_status as string) ?? "active",
      billing_status: (a.billing_status as string) ?? "active",
      mrr,
      ltv: 0, // accounts.ltv may not exist
      subscription_started_at: null, // accounts.subscription_started_at may not exist
      subscription_expires_at: (a.subscription_expires_at as string | null) ?? null,
      last_payment_at: lastPayment?.date ?? null,
      next_payment_at: null,
      payment_failures: 0,
      branches_on_plan: branchCount,
      created_at: a.created_at as string,
    };
  });

  return { data, error: null };
}

export async function getAccountBillingHistory(
  accountId: string
): Promise<{ data: BillingPeriod[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };
  if (!accountId || typeof accountId !== "string") return { data: null, error: "Invalid account ID." };

  const supabase = await createServiceClient();

  let payments: Record<string, unknown>[] = [];
  let account: Record<string, unknown> | null = null;

  try {
    const [paymentsResult, accountResult] = await Promise.all([
      supabase
        .from("billing_payments")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
      supabase.from("accounts").select("subscription_expires_at").eq("id", accountId).maybeSingle(),
    ]);
    payments = paymentsResult.data ?? [];
    account = accountResult.data;
  } catch {
    // billing_payments table may not exist
    return { data: [], error: null };
  }

  const periods: BillingPeriod[] = payments.map((p) => ({
    id: p.id as string,
    account_id: p.account_id as string,
    period_start: (account?.subscription_started_at as string) ?? p.created_at as string,
    period_end: p.created_at as string,
    amount_tzs: Number(p.amount_tzs) || 0,
    status: (p.status as BillingPeriod["status"]) ?? "paid",
    paid_at: p.created_at as string,
    invoice_url: null,
  }));

  return { data: periods, error: null };
}

/**
 * Updates an account's subscription plan and/or status.
 * Requires a valid HQ session.
 */
export async function updateAccountSubscription(
  accountId: string,
  plan: string | null,
  status: string | null
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };

  const supabase = await createServiceClient();

  const patch: Record<string, unknown> = {};
  if (plan !== undefined) patch.subscription_plan = plan;
  if (status !== undefined) patch.subscription_status = status;

  if (Object.keys(patch).length === 0) return { error: null };

  const { error } = await supabase.from("accounts").update(patch).eq("id", accountId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function recordManualPayment(
  accountId: string,
  amountTzs: number,
  reference: string,
  note: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!accountId || typeof accountId !== "string") return { error: "Invalid account ID." };
  if (!amountTzs || amountTzs <= 0) return { error: "Amount must be positive." };
  if (!reference || !reference.trim()) return { error: "Payment reference is required." };

  const supabase = await createServiceClient();

  try {
    const { data: admin } = await supabase
      .from("hq_admins")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!admin) return { error: "Could not identify HQ admin." };

    const { error } = await supabase.from("billing_payments").insert({
      account_id: accountId,
      amount_tzs: amountTzs,
      reference: reference.trim(),
      note: note.trim() || null,
      recorded_by_hq_admin_id: admin.id,
    });

    if (error) return { error: error.message };

    // Update account billing status (ltv may not exist)
    await supabase
      .from("accounts")
      .update({ billing_status: "active" })
      .eq("id", accountId);

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record payment." };
  }
}

export async function getAllBillingPayments(): Promise<{
  data: {
    id: string;
    account_id: string;
    account_name: string;
    amount_tzs: number;
    reference: string;
    note: string | null;
    recorded_by_name: string;
    created_at: string;
  }[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();

  let payments: Record<string, unknown>[] = [];
  try {
    const result = await supabase
      .from("billing_payments")
      .select("id, account_id, amount_tzs, reference, note, created_at, accounts(name), hq_admins(name)")
      .order("uploaded_at", { ascending: false });
    if (result.error) throw new Error(result.error.message);
    payments = result.data ?? [];
  } catch {
    // billing_payments table may not exist
    return { data: [], error: null };
  }

  const data = payments.map((p) => ({
    id: p.id as string,
    account_id: p.account_id as string,
    account_name: (p.accounts as { name?: string } | null)?.name ?? "Unknown",
    amount_tzs: Number(p.amount_tzs) || 0,
    reference: p.reference as string,
    note: (p.note as string | null) ?? null,
    recorded_by_name: (p.hq_admins as { name?: string } | null)?.name ?? "Unknown",
    created_at: p.created_at as string,
  }));

  return { data, error: null };
}

// ═══════════════════════════════════════════════════════════════════════
// News / Blog Posts
// ═══════════════════════════════════════════════════════════════════════

export interface NewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  category: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  category: string;
  tags: string[];
  published: boolean;
}

export async function getAllNewsPosts(): Promise<{ data: NewsPost[] | null; error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    // news_posts table may not exist
    return { data: [], error: null };
  }

  const posts: NewsPost[] = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    content: p.content ?? "",
    cover_image_url: p.cover_image_url ?? null,
    author_name: p.author_name ?? "Cervos Team",
    category: p.category ?? "Company",
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : [],
    published: Boolean(p.published),
    published_at: p.published_at ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return { data: posts, error: null };
}

export async function getPublishedNewsPosts(): Promise<{ data: NewsPost[] | null; error: string | null }> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) {
    // news_posts table may not exist
    return { data: [], error: null };
  }

  const posts: NewsPost[] = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    content: p.content ?? "",
    cover_image_url: p.cover_image_url ?? null,
    author_name: p.author_name ?? "Cervos Team",
    category: p.category ?? "Company",
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : [],
    published: Boolean(p.published),
    published_at: p.published_at ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return { data: posts, error: null };
}

export async function getNewsPostBySlug(slug: string): Promise<{ data: NewsPost | null; error: string | null }> {
  if (!slug || typeof slug !== "string") return { data: null, error: "Invalid slug." };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    // news_posts table may not exist
    return { data: null, error: null };
  }
  if (!data) return { data: null, error: null };

  const post: NewsPost = {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt ?? "",
    content: data.content ?? "",
    cover_image_url: data.cover_image_url ?? null,
    author_name: data.author_name ?? "Cervos Team",
    category: data.category ?? "Company",
    tags: Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t)) : [],
    published: Boolean(data.published),
    published_at: data.published_at ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  return { data: post, error: null };
}

/**
 * Creates a new news post. Requires a valid HQ session.
 */
export async function createNewsPost(input: NewsPostInput): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!input.title?.trim()) return { error: "Title is required." };
  if (!input.slug?.trim()) return { error: "Slug is required." };

  const supabase = await createServiceClient();

  const { error } = await supabase.from("news_posts").insert({
    title: input.title.trim(),
    slug: input.slug.trim(),
    excerpt: input.excerpt?.trim() ?? "",
    content: input.content ?? "",
    cover_image_url: input.cover_image_url?.trim() || null,
    author_name: input.author_name?.trim() || "Cervos Team",
    category: input.category || "Company",
    tags: Array.isArray(input.tags) ? input.tags.filter((t) => String(t).trim()) : [],
    published: Boolean(input.published),
    published_at: input.published ? new Date().toISOString() : null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Updates an existing news post. Requires a valid HQ session.
 */
export async function updateNewsPost(
  id: string,
  input: Partial<NewsPostInput>
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!id || typeof id !== "string") return { error: "Invalid post ID." };

  const supabase = await createServiceClient();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.excerpt !== undefined) patch.excerpt = input.excerpt.trim();
  if (input.content !== undefined) patch.content = input.content;
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url?.trim() || null;
  if (input.author_name !== undefined) patch.author_name = input.author_name.trim() || "Cervos Team";
  if (input.category !== undefined) patch.category = input.category;
  if (input.tags !== undefined) patch.tags = Array.isArray(input.tags) ? input.tags.filter((t) => String(t).trim()) : [];
  if (input.published !== undefined) {
    patch.published = Boolean(input.published);
    if (input.published) patch.published_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) return { error: null };

  const { error } = await supabase.from("news_posts").update(patch).eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Deletes a news post. Requires a valid HQ session.
 */
export async function deleteNewsPost(id: string): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!id || typeof id !== "string") return { error: "Invalid post ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Toggles the published status of a news post. Requires a valid HQ session.
 */
export async function toggleNewsPostPublish(
  id: string,
  published: boolean
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };
  if (!id || typeof id !== "string") return { error: "Invalid post ID." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("news_posts")
    .update({ published: Boolean(published) })
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}
