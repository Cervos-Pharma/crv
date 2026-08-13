/**
 * @route GET /api/sync
 * @route POST /api/sync
 * @access Desktop endpoint — authenticated via Cervos session cookie (same as web).
 *         The desktop app stores the session cookie after the user links their
 *         admin account in the desktop app settings.
 *
 * GET  — Returns delta changes since `since` query param (ISO timestamp).
 *        Response: SyncResponse JSON.
 *
 * POST — Acknowledges a completed sync round. Body: { branchId, syncedAt, accountId }.
 *        Updates branches.last_synced_at so next delta query is clean.
 *        Response: { error: string | null }
 *
 * @sideEffect POST upserting sync acknowledgement requires service-role access
 *             (bypasses RLS since the desktop app is multi-branch-scoped).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSyncData, acknowledgeSync } from "@/lib/actions/desktop-sync";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since");
  if (!since) {
    return NextResponse.json({ error: "Missing ?since= query param" }, { status: 400 });
  }

  const accountId = request.headers.get("x-account-id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing x-account-id header" }, { status: 400 });
  }

  try {
    const data = await getSyncData(since, accountId);
    if (!data) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/sync error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const accountId = request.headers.get("x-account-id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing x-account-id header" }, { status: 400 });
  }

  let body: { branchId?: string; syncedAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.branchId || !body.syncedAt) {
    return NextResponse.json({ error: "branchId and syncedAt are required" }, { status: 400 });
  }

  try {
    const result = await acknowledgeSync(body.branchId, body.syncedAt, accountId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ error: null });
  } catch (err) {
    console.error("POST /api/sync error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
