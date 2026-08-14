import { supabase, isConfigured } from "./supabase";
import { Fe, Pe, Et, Mt } from "./database";
import type { DashboardStats } from "../types";

let Ie: any = null;

export async function Xd(n: string, t: string): Promise<void> {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [n, JSON.stringify(t)]
  );
}

export async function q0(n: string): Promise<string | null> {
  const result = await Fe(
    "SELECT value FROM app_settings WHERE key = ?",
    [`last_pull_${n}`]
  );
  return result.length > 0 ? result[0].value : null;
}

export async function K0(n: string, t: string): Promise<void> {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [`last_pull_${n}`, t]
  );
}

export async function Z8(): Promise<boolean> {
  if (!isConfigured) return false;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    Ie = supabase;
    return true;
  }
  return false;
}

export async function Nd(
  n: string,
  t: string
): Promise<void> {
  if (!isConfigured) throw new Error("Supabase is not configured yet.");
  Ie = supabase;
  const { error } = await Ie.auth.signInWithPassword({
    email: n,
    password: t,
  });
  if (error) {
    Ie = null;
    throw new Error(error.message);
  }
}

export async function Pd(): Promise<void> {
  if (!Ie) throw new Error("Not linked to Supabase.");
  const { data: user } = await Ie.auth.getUser();
  if (!user.user) return;

  const { data: account } = await Ie
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.user.id)
    .maybeSingle();

  if (!account) return;

  const branchId = Et();
  await Ie.from("branches").insert({
    id: branchId,
    account_id: account.id,
    name: "Main Branch",
    subscription_status: "trial",
  });
}

export async function tp(): Promise<void> {
  await Ie?.auth.signOut();
  Ie = null;
}

export async function np(): Promise<DashboardStats> {
  const linked = await Z8();
  const pendingResult = await Fe("SELECT COUNT(*) AS c FROM sync_queue");
  const pendingCount = pendingResult[0]?.c ?? 0;
  const lastSyncResult = await Fe(
    "SELECT value FROM app_settings WHERE key = 'last_synced_at'"
  );
  const lastSyncedAt = lastSyncResult[0]?.value ?? null;

  return {
    linked,
    pendingCount,
    lastSyncedAt,
    isSyncing: false,
  };
}

export async function sp(n: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(n);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function Wf(): Promise<void> {
  const isLinked = await Z8();
  if (isLinked) {
    await Pd();
  }
}

export async function qs(tableName: string, rowId: string, operation: string, payload: any): Promise<void> {
  const id = Et();
  await Pe(
    `INSERT INTO sync_queue (id, table_name, row_id, operation, payload, created_at, attempts) VALUES (?,?,?,?,?,?,?)`,
    [id, tableName, rowId, operation, JSON.stringify(payload), Mt(), 0]
  );
}

export async function zf(): Promise<boolean> {
  const result = await Fe("SELECT value FROM app_settings WHERE key = 'pharmacy_name'");
  return result.length > 0;
}

export function getSupabase() {
  return Ie || supabase;
}
