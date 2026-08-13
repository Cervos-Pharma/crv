import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveSupplierQuoteAnswers, getSupplierQuoteAnswers } from "@/lib/actions/hq";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quoteRequestId = request.nextUrl.searchParams.get("quoteRequestId");
  if (!quoteRequestId) {
    return NextResponse.json({ error: "Quote request ID is required" }, { status: 400 });
  }

  const result = await getSupplierQuoteAnswers(quoteRequestId);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { quoteRequestId, answers } = body;

  if (!quoteRequestId) {
    return NextResponse.json({ error: "Quote request ID is required" }, { status: 400 });
  }

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Answers object is required" }, { status: 400 });
  }

  const result = await saveSupplierQuoteAnswers(quoteRequestId, {
    expectedBranches: answers.expectedBranches,
    annualVolume: answers.annualVolume,
    currentSupplier: answers.currentSupplier,
    notes: answers.notes,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
