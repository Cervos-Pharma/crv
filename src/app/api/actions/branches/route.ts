import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/lib/actions/branches";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!account || account.type !== "pharmacy") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { name, address, lat, lng } = body;
    const result = await createBranch(account.id, { name, address, lat, lng });
    return NextResponse.json(result);
  }

  if (action === "update") {
    const { id, updates } = body;
    const result = await updateBranch(id, account.id, updates);
    return NextResponse.json(result);
  }

  if (action === "delete") {
    const { id } = body;
    const result = await deleteBranch(id, account.id);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
