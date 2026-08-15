import { NextRequest, NextResponse } from "next/server";
import { getSalesReport } from "@/lib/actions/reports";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const branchId = searchParams.get("branchId") ?? undefined;

  if (!accountId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "accountId, dateFrom, and dateTo are required" },
      { status: 400 }
    );
  }

  const report = await getSalesReport(accountId, dateFrom, dateTo, branchId);
  return NextResponse.json(report);
}
