/**
 * @route /hq/network
 * @access HQ session required (HMAC cookie `hq_sess`)
 * @description Live pharmacy branch map for HQ — all branches with real
 *   coordinates, coloured by subscription status.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HQSidebarServer from "@/components/HQSidebarServer";
import CervosMap from "@/components/MapClientWrapper";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

export default async function HQNetworkPage() {
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  type BranchRow = {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    subscription_status: string;
    accounts: { name: string } | null;
  };

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, lat, lng, subscription_status, accounts(name)")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const markers = ((branches ?? []) as unknown as BranchRow[]).map((b) => {
    const acct = Array.isArray(b.accounts) ? b.accounts[0] : b.accounts;
    const status = b.subscription_status as "online" | "offline" | "grace";
    return {
      lat: b.lat as number,
      lng: b.lng as number,
      label: `${b.name} — ${acct?.name ?? "Unknown"}`,
      status,
    };
  });

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 ml-64 flex flex-col p-8 pt-12">
        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              HQ Console
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep">Network Map</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {markers.length} branch{markers.length !== 1 ? "es" : ""} with live coordinates.
            </p>
          </div>

          <div className="flex gap-6 mb-6">
            {[
              { colour: "bg-primary", label: "Online" },
              { colour: "bg-amber-500", label: "Grace Period" },
              { colour: "bg-error", label: "Offline / Locked" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${l.colour}`} />
                <span className="font-label-md text-label-md text-on-surface-variant text-sm">
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          <div className="border border-outline-variant rounded overflow-hidden h-[600px]">
            {markers.length > 0 ? (
              <CervosMap
                center={[markers[0].lat, markers[0].lng]}
                zoom={11}
                markers={markers}
                className="h-[600px] w-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-surface-container-low">
                <p className="font-body-md text-on-surface-variant">
                  No branches have location data yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
