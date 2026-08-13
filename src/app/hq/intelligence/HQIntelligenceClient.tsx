/**
 * @file hq/intelligence/HQIntelligenceClient.tsx
 * @description Client component for the HQ Intelligence page. Renders the
 *   overview stat cards, period-to-date metrics (quote funnel, support,
 *   sales), demographic breakdowns, and recent network activity. Period
 *   switching refetches the overview via the `getIntelligenceOverview`
 *   server action.
 */
"use client";

import { useState } from "react";
import {
  getIntelligenceOverview,
  type IntelligenceOverview,
  type DemographicsBreakdown,
  type SyncHealthMetrics,
  type EngagementMetrics,
  type NetworkHealthMetrics,
  type RevenueMetrics,
} from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  overview: IntelligenceOverview | null;
  overviewError: string | null;
  demographics: DemographicsBreakdown | null;
  demographicsError: string | null;
  syncHealth: SyncHealthMetrics | null;
  syncHealthError: string | null;
  engagement: EngagementMetrics | null;
  engagementError: string | null;
  networkHealth: NetworkHealthMetrics | null;
  networkHealthError: string | null;
  revenue: RevenueMetrics | null;
  revenueError: string | null;
  hourlyActivity: { hour: string; actions: number }[] | null;
  hourlyActivityError: string | null;
}

type Period = 30 | 90 | 0;
type Tab = "overview" | "sync" | "engagement" | "revenue" | "network";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  sync: "Sync Health",
  engagement: "Engagement",
  revenue: "Revenue",
  network: "Network",
};

function periodLabel(days: Period): string {
  return days === 0 ? "All time" : `Last ${days} days`;
}

function currency(amount: number): string {
  return "TZS " + Math.round(amount).toLocaleString();
}

const CHART_COLORS = ["#6750A4", "#625B71", "#7D5260", "#B3261E", "#0061A4", "#146C2E", "#7D5260"];

export default function HQIntelligenceClient({
  overview,
  overviewError,
  demographics,
  demographicsError,
  syncHealth,
  syncHealthError,
  engagement,
  engagementError,
  networkHealth,
  networkHealthError,
  revenue,
  revenueError,
  hourlyActivity,
  hourlyActivityError,
}: Props) {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<IntelligenceOverview | null>(overview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(overviewError);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  async function switchPeriod(next: Period) {
    if (next === period) return;
    setPeriod(next);
    setLoading(true);
    try {
      const result = await getIntelligenceOverview(next);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.totals;
  const periodStats = data?.period;

  function renderOverview() {
    return (
      <>
        <div className="flex items-center gap-2 mb-8">
          {([30, 90, 0] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPeriod(p)}
              disabled={loading}
              className={`px-4 py-2 font-label-md text-label-md transition-colors disabled:opacity-60 ${
                period === p
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {periodLabel(p)}
            </button>
          ))}
          {loading && (
            <div className="ml-2 w-4 h-4 border border-primary/40 border-t-primary rounded-full animate-spin" />
          )}
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
            <p className="font-body-md">Error loading intelligence: {error}</p>
          </div>
        )}

        {data && stats ? (
          <>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Network totals
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Accounts", value: stats.accounts, sub: `${stats.pharmacies} pharm · ${stats.suppliers} supp` },
                { label: "Suspended", value: stats.suspended, danger: true },
                { label: "Branches", value: stats.branches, sub: `${stats.lockedBranches} locked` },
                { label: "Operators", value: stats.operators },
                { label: "Installs", value: stats.installs },
                { label: "Onboarding done", value: stats.onboardingCompleted },
              ].map((s) => (
                <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
                  <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : "text-ink-deep"}`}>
                    {s.value}
                  </p>
                  {s.sub && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{s.sub}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              {periodLabel(period)} activity
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Quote requests", value: periodStats?.quoteRequests ?? 0 },
                { label: "Support tickets", value: periodStats?.supportTickets ?? 0, sub: `${periodStats?.openSupportTickets ?? 0} open` },
                { label: "New accounts", value: periodStats?.newAccounts ?? 0 },
                { label: "Sales revenue", value: currency(periodStats?.salesRevenue ?? 0), sub: `${periodStats?.sales ?? 0} transactions` },
              ].map((s) => (
                <div key={s.label} className="bg-surface-container-low border border-outline-variant p-5">
                  <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="font-headline-sm text-headline-sm text-ink-deep mt-1">{s.value}</p>
                  {s.sub && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface-base border border-outline-variant p-6">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                  Quote funnel
                </p>
                {(data.quoteFunnel.length === 0 || data.quoteFunnel.every((f) => f.count === 0)) ? (
                  <p className="font-body-md text-on-surface-variant">No quote requests in this period.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.quoteFunnel.map((f) => {
                      const max = Math.max(...data.quoteFunnel.map((x) => x.count), 1);
                      return (
                        <div key={f.status}>
                          <div className="flex justify-between font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">
                            <span>{f.status}</span>
                            <span>{f.count}</span>
                          </div>
                          <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round((f.count / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-surface-base border border-outline-variant p-6">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                  Support tickets
                </p>
                <div className="flex flex-col gap-3">
                  {data.supportBreakdown.map((s) => (
                    <div
                      key={s.status}
                      className="flex items-center justify-between border border-outline-variant/40 px-4 py-3"
                    >
                      <span className="font-label-md text-label-md capitalize text-on-surface">{s.status}</span>
                      <span className="font-headline-md text-headline-md text-ink-deep">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Demographics
            </p>
            {demographicsError ? (
              <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
                <p className="font-body-md">Error loading demographics: {demographicsError}</p>
              </div>
            ) : demographics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {[
                  { title: "Account types", buckets: demographics.accountTypes },
                  { title: "Regions", buckets: demographics.regions },
                  { title: "Roles", buckets: demographics.roles },
                  { title: "Tech comfort", buckets: demographics.techComfort },
                  { title: "Goals", buckets: demographics.goals },
                ].map((group) => (
                  <div key={group.title} className="bg-surface-base border border-outline-variant p-6">
                    <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                      {group.title}
                    </p>
                    {group.buckets.length === 0 ? (
                      <p className="font-body-md text-on-surface-variant">No data yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {group.buckets.map((b) => {
                          const max = Math.max(...group.buckets.map((x) => x.count), 1);
                          return (
                            <div key={b.label}>
                              <div className="flex justify-between font-body-sm text-body-sm mb-1">
                                <span className="text-on-surface capitalize">{b.label}</span>
                                <span className="text-on-surface-variant font-mono">{b.count}</span>
                              </div>
                              <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-secondary rounded-full"
                                  style={{ width: `${Math.round((b.count / max) * 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Recent activity
            </p>
            <div className="bg-surface-base border border-outline-variant rounded overflow-hidden mb-8">
              {data.recentActivity.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-body-md text-on-surface-variant">No activity recorded yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/30">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="px-6 py-4 flex items-start gap-4">
                      <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                        {a.action === "sale" || a.action === "sale_created" ? "point_of_sale" : "bolt"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body-md text-body-md text-ink-deep">
                          {a.accountName ?? "Unknown account"}
                          {a.branchName ? <span className="text-on-surface-variant"> · {a.branchName}</span> : null}
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {a.action}
                          {a.detail ? <span className="font-mono text-xs"> — {a.detail.slice(0, 120)}</span> : null}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-on-surface-variant whitespace-nowrap pt-0.5">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </>
    );
  }

  function renderSyncHealth() {
    if (syncHealthError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading sync health: {syncHealthError}</p>
        </div>
      );
    }
    if (!syncHealth) return null;

    const syncStatusData = [
      { name: "Synced <24h", value: syncHealth.syncedRecently, color: "#146C2E" },
      { name: "Synced <7d", value: syncHealth.syncedThisWeek - syncHealth.syncedRecently, color: "#0061A4" },
      { name: "Stale (7d+)", value: syncHealth.staleBranches, color: "#B3261E" },
      { name: "Never Synced", value: syncHealth.neverSynced, color: "#7D5260" },
    ].filter((d) => d.value > 0);

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Sync Health
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Branches", value: syncHealth.totalBranches },
            { label: "Synced <24h", value: syncHealth.syncedRecently, success: true },
            { label: "Synced <7d", value: syncHealth.syncedThisWeek },
            { label: "Stale (7d+)", value: syncHealth.staleBranches, danger: true },
            { label: "Never Synced", value: syncHealth.neverSynced, danger: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : s.success ? "text-success" : "text-ink-deep"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Sync Status Distribution</p>
            {syncStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={syncStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {syncStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No sync data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Avg Sync Frequency</p>
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <p className="font-headline-lg text-headline-lg text-ink-deep">{syncHealth.avgSyncFrequencyHours}h</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">average between syncs</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Branches by Subscription Status</p>
          {syncHealth.branchesBySyncStatus.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {syncHealth.branchesBySyncStatus.map((s) => {
                const max = Math.max(...syncHealth.branchesBySyncStatus.map((x) => x.count), 1);
                return (
                  <div key={s.status}>
                    <div className="flex justify-between font-body-sm text-body-sm mb-1">
                      <span className="text-on-surface capitalize">{s.status}</span>
                      <span className="text-on-surface-variant font-mono">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">No data available.</p>
          )}
        </div>
      </>
    );
  }

  function renderEngagement() {
    if (engagementError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading engagement: {engagementError}</p>
        </div>
      );
    }
    if (!engagement) return null;

    const regionData = engagement.topRegionsByActivity.map((r) => ({
      region: r.region,
      orders: r.orderCount,
      revenue: r.revenue,
    }));

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Engagement
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "DAU/WAU Ratio", value: engagement.dauWauRatio.toFixed(2) },
            { label: "Active Today", value: engagement.activeUsersToday },
            { label: "Active This Week", value: engagement.activeUsersThisWeek },
            { label: "30-Day Retention", value: `${engagement.retentionRate30Day}%` },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className="font-headline-lg text-headline-lg text-ink-deep mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top Regions by Activity</p>
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={regionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="region" width={80} />
                  <Tooltip />
                  <Bar dataKey="orders" fill={CHART_COLORS[0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No region data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Hourly Activity (24h)</p>
            {hourlyActivity && hourlyActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="actions" fill={CHART_COLORS[1]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No hourly data available.</p>
            )}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">New Accounts & Transactions</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-body-sm text-on-surface-variant">New Accounts (Month)</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.newAccountsThisMonth}</p>
            </div>
            <div>
              <p className="font-body-sm text-on-surface-variant">Transacting Accounts (Month)</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.accountsWhoTransactedThisMonth}</p>
            </div>
            <div>
              <p className="font-body-sm text-on-surface-variant">Avg Orders per Transacting Account</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.avgOrdersPerTransactingAccount}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderRevenue() {
    if (revenueError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading revenue: {revenueError}</p>
        </div>
      );
    }
    if (!revenue) return null;

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Revenue
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Revenue", value: currency(revenue.totalRevenue) },
            { label: "MTD Revenue", value: currency(revenue.mtdRevenue) },
            { label: "YTD Revenue", value: currency(revenue.ytdRevenue) },
            { label: "Avg Order Value", value: currency(revenue.avgOrderValue) },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className="font-headline-sm text-headline-sm text-ink-deep mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue Trend (Daily)</p>
            {revenue.revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenue.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Line type="monotone" dataKey="amount" stroke={CHART_COLORS[0]} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No revenue data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue by Region</p>
            {revenue.revenueByRegion.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue.revenueByRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="region" width={80} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="amount" fill={CHART_COLORS[2]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No region data available.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue by Account Type</p>
            {revenue.revenuePerAccountType.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenue.revenuePerAccountType}
                    dataKey="revenue"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {revenue.revenuePerAccountType.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => currency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No type data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 10 Accounts by Revenue</p>
            {revenue.topAccountsByRevenue.length > 0 ? (
              <div className="flex flex-col gap-2">
                {revenue.topAccountsByRevenue.map((a, i) => (
                  <div key={a.accountId} className="flex items-center justify-between">
                    <span className="font-body-sm text-on-surface">{i + 1}. {a.name}</span>
                    <span className="font-mono text-xs text-on-surface-variant">{currency(a.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-md text-on-surface-variant">No account data available.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderNetwork() {
    if (networkHealthError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading network health: {networkHealthError}</p>
        </div>
      );
    }
    if (!networkHealth) return null;

    const statusData = [
      { name: "Healthy", value: networkHealth.healthyStatus, color: "#146C2E" },
      { name: "At Risk", value: networkHealth.atRiskStatus, color: "#B3261E" },
      { name: "Locked", value: networkHealth.lockedStatus, color: "#7D5260" },
    ].filter((d) => d.value > 0);

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Network Health
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Branches", value: networkHealth.totalBranches },
            { label: "Online Now", value: networkHealth.onlineNow, success: true },
            { label: "Healthy", value: networkHealth.healthyStatus, success: true },
            { label: "At Risk", value: networkHealth.atRiskStatus, danger: true },
            { label: "Locked", value: networkHealth.lockedStatus, danger: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : s.success ? "text-success" : "text-ink-deep"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Status Distribution</p>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No status data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Inventory Health</p>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-body-sm text-on-surface-variant">Avg Batches per Branch</p>
                <p className="font-headline-md text-headline-md text-ink-deep">{networkHealth.avgBatchesPerBranch}</p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Avg Products per Branch</p>
                <p className="font-headline-md text-headline-md text-ink-deep">{networkHealth.avgProductsPerBranch}</p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Expiring Batches (30 days)</p>
                <p className={`font-headline-md text-headline-md ${networkHealth.expiringBatchesThisMonth > 0 ? "text-error" : "text-ink-deep"}`}>
                  {networkHealth.expiringBatchesThisMonth}
                </p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Out of Stock Products</p>
                <p className={`font-headline-md text-headline-md ${networkHealth.outOfStockProducts > 0 ? "text-error" : "text-ink-deep"}`}>
                  {networkHealth.outOfStockProducts}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-8 border-b border-outline-variant pb-4">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-label-md text-label-md transition-colors ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "sync" && renderSyncHealth()}
      {activeTab === "engagement" && renderEngagement()}
      {activeTab === "revenue" && renderRevenue()}
      {activeTab === "network" && renderNetwork()}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
