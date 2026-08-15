"use server";

import { createClient } from "@/lib/supabase/server";

export interface Branch {
  id: string;
  account_id: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  created_at?: string;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export async function getBranches(accountId: string): Promise<Branch[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("branches")
    .select(
      "id, account_id, name, address, lat, lng, subscription_status, trial_ends_at, grace_ends_at, created_at"
    )
    .eq("account_id", accountId)
    .order("name");

  return (data ?? []) as Branch[];
}

export async function createBranch(
  accountId: string,
  input: CreateBranchInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("branches").insert({
    account_id: accountId,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateBranch(
  id: string,
  accountId: string,
  input: UpdateBranchInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("branches")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .single();

  if (!existing) return { error: "Branch not found or access denied." };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.address !== undefined) updates.address = input.address;
  if (input.lat !== undefined) updates.lat = input.lat;
  if (input.lng !== undefined) updates.lng = input.lng;

  const { error } = await supabase
    .from("branches")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteBranch(
  id: string,
  accountId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("branches")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .single();

  if (!existing) return { error: "Branch not found or access denied." };

  const { data: operators } = await supabase
    .from("operators")
    .select("id")
    .eq("branch_id", id)
    .limit(1);

  if (operators && operators.length > 0) {
    return { error: "Cannot delete branch with operators. Reassign operators first." };
  }

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("branch_id", id)
    .limit(1);

  if (sales && sales.length > 0) {
    return { error: "Cannot delete branch with sales records." };
  }

  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}
