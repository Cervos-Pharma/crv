/**
 * @file lib/actions/auth.ts
 * @description Supabase authentication server actions.
 *
 * These actions wrap the Supabase auth SDK for use in server-side contexts.
 * They are NOT currently used by the auth page (`app/auth/page.tsx`), which
 * calls the Supabase browser SDK directly — this is intentional because
 * `signUp` requires `emailRedirectTo` with `window.location.origin`, which is
 * only available in the browser.
 *
 * These actions exist for reuse by other pages (e.g. sign-out buttons in
 * sidebars) and for future refactoring if the auth page moves to server actions.
 *
 * Supabase tables touched:
 *   - auth.users — read/write via Supabase Auth SDK (not direct SQL)
 *   - accounts   — populated by a Supabase Database trigger on `auth.users` insert
 *                  (trigger must be configured in Supabase dashboard)
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Signs in an existing user with email + password.
 * On success, Supabase sets session cookies automatically via the SSR adapter.
 *
 * @param email    - The user's email address
 * @param password - The user's password (min 8 chars enforced by Supabase)
 * @returns `{ error }` — null on success, Supabase error message string on failure
 */
export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Registers a new user account and sends an email confirmation link.
 * Additional profile metadata is stored in `auth.users.raw_user_meta_data`
 * and should be copied to the `accounts` table by a Supabase trigger.
 *
 * The caller (browser component) should provide `emailRedirectTo` via the
 * browser SDK directly, as `window.location.origin` is not available in
 * server actions — see `app/auth/page.tsx` for the browser-side implementation.
 *
 * @param opts.email       - New user's email address
 * @param opts.password    - Password (min 8 chars)
 * @param opts.fullName    - Full name stored in user_metadata.full_name
 * @param opts.phone       - Phone number stored in user_metadata.phone
 * @param opts.entityName  - Organisation/pharmacy name stored in user_metadata.entity_name
 * @param opts.accountType - "pharmacy" or "supplier" — stored in user_metadata.account_type
 * @param opts.inviteToken - Optional invite token to link to supplier account
 * @returns `{ error }` — null on success (email confirmation pending)
 */
export async function signUp(opts: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  entityName: string;
  accountType: "pharmacy" | "supplier";
  inviteToken?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      data: {
        full_name: opts.fullName,
        phone: opts.phone,
        account_type: opts.accountType,
        entity_name: opts.entityName,
        invite_token: opts.inviteToken ?? null,
      },
      email_confirm: true,
    } as any,
  });

  if (error) return { error: error.message };

  if (data.user && opts.inviteToken) {
    const serviceClient = await createServiceClient();
    const { data: account } = await serviceClient
      .from("accounts")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .single();

    if (account) {
      await linkInviteToAccount(opts.inviteToken, account.id);
    }
  }

  return { error: null };
}

async function linkInviteToAccount(inviteToken: string, accountId: string): Promise<{ error: string | null }> {
  const supabase = await createServiceClient();

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

  const { error: updateError } = await supabase
    .from("supplier_invites")
    .update({
      status: "accepted",
      supplier_account_id: accountId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateError) return { error: updateError.message };

  await supabase
    .from("accounts")
    .update({
      download_enabled: false,
      subscription_status: "trial",
      invite_token: inviteToken,
    })
    .eq("id", accountId);

  return { error: null };
}

/**
 * Links an invite token to an existing account (called after auth confirmation).
 * Sets download_enabled=false and subscription_status='trial' for new supplier accounts.
 */
export async function linkInviteTokenToAccount(inviteToken: string): Promise<{ error: string | null }> {
  if (!inviteToken) return { error: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const serviceClient = await createServiceClient();
  const { data: account } = await serviceClient
    .from("accounts")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return { error: "Account not found" };

  if (account.type !== "supplier") return { error: null };

  return linkInviteToAccount(inviteToken, account.id);
}

/**
 * Signs out the current user and redirects to `/auth`.
 * Clears the Supabase session cookies via the SSR adapter.
 * This is a `redirect()` call — it throws a Next.js redirect and never returns normally.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

/**
 * Returns the currently authenticated Supabase user, or null if unauthenticated.
 * Uses `getUser()` (verifies with Supabase server) not `getSession()` (client-side only).
 *
 * Prefer this over reading user data from localStorage or session tokens —
 * `getUser()` is the only method that validates the JWT server-side.
 *
 * @returns The authenticated `User` object, or null if no session
 */
export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
