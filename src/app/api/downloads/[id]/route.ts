import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function extractStoragePath(fileUrl: string): string {
  if (fileUrl.includes("/storage/v1/object/")) {
    const match = fileUrl.match(/\/storage\/v1\/object\/public\/app-releases\/(.+)/);
    if (match) return match[1];
  }
  return fileUrl;
}

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

  const storagePath = extractStoragePath(release.file_url);

  let signedUrlData;
  try {
    const result = await supabase.storage
      .from("app-releases")
      .createSignedUrl(storagePath, 60);
    signedUrlData = result.data;
  } catch (err: any) {
    console.error("[download-api] createSignedUrl error:", err?.message, "storagePath:", storagePath);
    return NextResponse.json({ error: `Storage error: ${err?.message}` }, { status: 500 });
  }

  if (!signedUrlData) {
    console.error("[download-api] createSignedUrl returned null, error:", signedUrlData);
    return NextResponse.json({ error: "Download unavailable. Please contact support." }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrlData.signedUrl });
}
