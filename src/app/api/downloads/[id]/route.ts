import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing release ID" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: release, error } = await supabase
    .from("app_releases")
    .select("file_url, platform, version")
    .eq("id", id)
    .single();

  if (error || !release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from("app-releases")
    .createSignedUrl(release.file_url, 60);

  if (urlError || !signedUrlData) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrlData.signedUrl });
}
