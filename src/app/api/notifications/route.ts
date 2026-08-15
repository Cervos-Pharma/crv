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

  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .gte("created_at", since)
      .eq("read", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (accountId) query = query.eq("account_id", accountId);
    if (branchId) query = query.eq("branch_id", branchId);

    const { data: notifications, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notifications: notifications ?? [], error: null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notification_ids, mark_all_read } = await req.json();

  try {
    if (mark_all_read) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("account_id", user.id);
    } else if (notification_ids && Array.isArray(notification_ids)) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", notification_ids);
    }

    return NextResponse.json({ error: null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update notifications" },
      { status: 500 }
    );
  }
}
