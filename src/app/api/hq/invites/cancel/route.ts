import { NextRequest, NextResponse } from "next/server";
import { cancelInvite } from "@/lib/actions/hq";
import { cookies } from "next/headers";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

async function assertHQAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_COOKIE_NAME)?.value;
  if (!isValidHQToken(token)) {
    return { authorized: false };
  }
  return { authorized: true };
}

export async function POST(request: NextRequest) {
  const auth = await assertHQAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { inviteId } = body;

  if (!inviteId) {
    return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
  }

  const result = await cancelInvite(inviteId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
