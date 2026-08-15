import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("account_id");
  const branchId = req.nextUrl.searchParams.get("branch_id");
  const since = req.nextUrl.searchParams.get("since") ?? "1970-01-01T00:00:00Z";

  if (!accountId) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  try {
    const { data: account } = await supabase
      .from("accounts")
      .select("type")
      .eq("id", accountId)
      .maybeSingle();

    const accountType = account?.type ?? "pharmacy";

    const { data: messages, error } = await supabase
      .from("hq_messages")
      .select("*")
      .gte("created_at", since)
      .or(
        `target_scope.eq.all,target_scope.eq.all_${accountType}s,target_scope.eq.account and target_account_id.eq.${accountId}${
          branchId ? `,target_scope.eq.branch and target_branch_id.eq.${branchId}` : ""
        }`
      )
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: messages ?? [], error: null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
