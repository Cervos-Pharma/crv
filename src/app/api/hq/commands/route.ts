/**
 * @route POST /api/hq/commands
 * @access HQ admin only — sends commands to pharmacy desktop endpoints.
 *
 * Commands are written to the `branch_commands` table and delivered
 * to the desktop app on next sync via the /api/sync response.
 *
 * Supported commands:
 *   { cmd: "lock_branch",   branchId, reason }
 *   { cmd: "unlock_branch", branchId }
 *   { cmd: "suspend_branch", branchId, reason }
 *   { cmd: "force_sync",    branchId }
 *
 * The desktop app polls GET /api/sync and receives pending commands
 * in the `commands` field of the sync response.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(HQ_COOKIE_NAME)?.value;
  if (!isValidHQToken(sessionToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    cmd: string;
    branchId: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cmd, branchId, reason } = body;

  if (!cmd || !branchId) {
    return NextResponse.json({ error: "cmd and branchId are required" }, { status: 400 });
  }

  const supported = ["lock_branch", "unlock_branch", "suspend_branch", "force_sync"];
  if (!supported.includes(cmd)) {
    return NextResponse.json({ error: `Unknown command. Supported: ${supported.join(", ")}` }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify branch exists
  const { data: branch } = await supabase
    .from("branches")
    .select("id, account_id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  // Write command to branch_commands table (table must exist — run migration first)
  const { error: cmdError } = await supabase.from("branch_commands").insert({
    branch_id: branchId,
    account_id: branch.account_id,
    command: cmd,
    reason: reason ?? null,
    status: "pending",
  });

  if (cmdError) {
    return NextResponse.json(
      { error: `Failed to queue command: ${cmdError.message}. Ensure branch_commands table exists.` },
      { status: 500 }
    );
  }

  // Execute command immediately on the branch record
  if (cmd === "lock_branch" || cmd === "suspend_branch") {
    await supabase
      .from("branches")
      .update({
        subscription_status: "locked",
        locked_reason: reason ?? "hq_command",
      })
      .eq("id", branchId);
  }

  if (cmd === "unlock_branch") {
    await supabase
      .from("branches")
      .update({
        subscription_status: "active",
        locked_reason: null,
      })
      .eq("id", branchId);
  }

  return NextResponse.json({
    error: null,
    commandId: branchId,
    message: `Command '${cmd}' queued for branch '${branch.name}'`,
  });
}
