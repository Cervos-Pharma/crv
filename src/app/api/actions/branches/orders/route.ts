import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ orders: orders ?? [] });
}
