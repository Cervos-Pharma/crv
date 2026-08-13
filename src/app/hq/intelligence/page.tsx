/**
 * @route /hq/intelligence
 * @access HQ operators only — validated via hq_sess cookie.
 * @description Server component that fetches the intelligence overview
 *   (top-line totals, period stats, quote funnel, support breakdown, recent
 *   activity) plus the demographics breakdown, then hands both to the client
 *   component for period switching.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";
import HQSidebarServer from "@/components/HQSidebarServer";
import { getIntelligenceOverview, getDemographicsBreakdown, getSyncHealthMetrics, getEngagementMetrics, getNetworkHealthMetrics, getRevenueMetrics, getHourlyActivityStats } from "@/lib/actions/hq";
import HQIntelligenceClient from "./HQIntelligenceClient";

export default async function HQIntelligencePage() {
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const [overviewResult, demographicsResult, syncHealthResult, engagementResult, networkHealthResult, revenueResult, hourlyResult] = await Promise.all([
    getIntelligenceOverview(30),
    getDemographicsBreakdown(),
    getSyncHealthMetrics(30),
    getEngagementMetrics(),
    getNetworkHealthMetrics(),
    getRevenueMetrics(30),
    getHourlyActivityStats(24),
  ]);

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 ml-64 p-8 pt-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              HQ Console
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep">Intelligence</h1>
          </div>

          <HQIntelligenceClient
            overview={overviewResult.data}
            overviewError={overviewResult.error}
            demographics={demographicsResult.data}
            demographicsError={demographicsResult.error}
            syncHealth={syncHealthResult.data}
            syncHealthError={syncHealthResult.error}
            engagement={engagementResult.data}
            engagementError={engagementResult.error}
            networkHealth={networkHealthResult.data}
            networkHealthError={networkHealthResult.error}
            revenue={revenueResult.data}
            revenueError={revenueResult.error}
            hourlyActivity={hourlyResult.data}
            hourlyActivityError={hourlyResult.error}
          />
        </div>
      </main>
    </div>
  );
}
