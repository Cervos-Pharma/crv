/**
 * @file components/InventoryTable.tsx
 * @description FEFO-sorted batch inventory table for the pharmacy portal.
 *  - ≤14 days: red (critical)
 *  - ≤30 days: amber (warning)
 *  - >30 days: green (safe)
 *
 * Supports searching by product/generic name, filtering by branch and expiry band,
 * and column sorting. Receives `batches` as a prop — data is fetched server-side
 * in `app/dashboard/inventory/page.tsx` and passed down.
 */
"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";

/** One row of batch data as rendered in the inventory table. */
export interface BatchRow {
  id: string;
  productName: string;
  genericName: string;
  batchNo: string;
  /** Branch display name */
  branch: string;
  quantity: number;
  /** ISO date string YYYY-MM-DD */
  expiryDate: string;
  /** Pre-computed days remaining until expiry */
  daysLeft: number;
}

interface InventoryTableProps {
  /** Full list of batch rows to display (may be filtered client-side). */
  batches: BatchRow[];
  /** All branch names for the filter dropdown. */
  branches: string[];
}

type SortKey = keyof BatchRow;
type SortDir = "asc" | "desc";

function ExpiryBadge({ daysLeft, t }: { daysLeft: number; t: (k: string, f?: string) => string }) {
  const d = t("inv.daysleft").replace("{n}", String(daysLeft));
  if (daysLeft <= 14) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-error text-error bg-error-container">
        <span className="w-1.5 h-1.5 rounded-full bg-error block" />
        {d}
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-[#b45309] text-[#b45309] bg-[#fef3c7]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#b45309] block" />
        {d}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-tertiary-container text-tertiary bg-[#dcfce7]">
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container block" />
      {d}
    </span>
  );
}

export default function InventoryTable({ batches, branches }: InventoryTableProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "critical" | "warning" | "ok">("all");
  const [sortKey, setSortKey] = useState<SortKey>("daysLeft");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    let rows = batches.filter((b) => {
      const matchSearch =
        b.productName.toLowerCase().includes(search.toLowerCase()) ||
        b.genericName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNo.toLowerCase().includes(search.toLowerCase());
      const matchBranch = branchFilter === "all" || b.branch === branchFilter;
      const matchExpiry =
        expiryFilter === "all" ||
        (expiryFilter === "critical" && b.daysLeft <= 14) ||
        (expiryFilter === "warning" && b.daysLeft > 14 && b.daysLeft <= 30) ||
        (expiryFilter === "ok" && b.daysLeft > 30);
      return matchSearch && matchBranch && matchExpiry;
    });

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [batches, search, branchFilter, expiryFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="material-symbols-outlined text-[14px] opacity-30">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[14px] text-primary-container">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
    );
  }

  const criticalCount = batches.filter((b) => b.daysLeft <= 14).length;
  const warningCount = batches.filter((b) => b.daysLeft > 14 && b.daysLeft <= 30).length;

  return (
    <div className="flex-1 p-8 flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-outline-variant" />
          <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">{t("inv.total")}</p>
          <p className="text-headline-md font-headline-md text-ink-deep">{batches.length}</p>
        </div>
        <div className="bg-error-container border border-error p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-error" />
          <p className="font-mono text-label-md text-on-error-container uppercase mb-1">{t("inv.critical")}</p>
          <p className="text-headline-md font-headline-md text-error">{criticalCount}</p>
        </div>
        <div className="bg-[#fef3c7] border border-[#b45309] p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-[#b45309]" />
          <p className="font-mono text-label-md text-[#92400e] uppercase mb-1">{t("inv.warning")}</p>
          <p className="text-headline-md font-headline-md text-[#b45309]">{warningCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex items-center flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder={t("inv.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-outline-variant bg-surface text-on-surface text-body-sm font-body-md focus:outline-none focus:border-primary-container w-full"
          />
        </div>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border border-outline-variant bg-surface text-on-surface text-body-sm font-body-md px-3 py-2 focus:outline-none focus:border-primary-container"
        >
          <option value="all">{t("inv.allbranches")}</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="flex gap-2">
          {(["all", "critical", "warning", "ok"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setExpiryFilter(f)}
              className={`font-mono text-label-md px-3 py-1.5 border uppercase transition-colors ${
                expiryFilter === f
                  ? "bg-ink-deep text-white border-ink-deep"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {f === "all" ? t("inv.all") : f === "critical" ? t("inv.critical.f") : f === "warning" ? t("inv.warning.f") : t("inv.ok")}
            </button>
          ))}
        </div>
        <span className="font-mono text-label-md text-on-surface-variant ml-auto">
          {t("inv.rows").replace("{a}", String(filtered.length)).replace("{b}", String(batches.length))}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              {([
                ["productName", "inv.col.product"],
                ["batchNo", "inv.col.batch"],
                ["branch", "inv.col.branch"],
                ["quantity", "inv.col.qty"],
                ["expiryDate", "inv.col.expiry"],
                ["daysLeft", "inv.col.days"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase cursor-pointer select-none hover:text-on-surface transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {t(label)}
                    <SortIcon k={key} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">
                {t("inv.col.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant font-body-md">
                  {t("inv.noresults")}
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-outline-variant hover:bg-surface-container-low transition-colors relative ${
                  row.daysLeft <= 14 ? "border-l-4 border-l-error" :
                  row.daysLeft <= 30 ? "border-l-4 border-l-[#b45309]" :
                  "border-l-4 border-l-tertiary-container"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-body-sm text-ink-deep">{row.productName}</div>
                  <div className="font-mono text-[10px] text-on-surface-variant mt-0.5">{row.genericName}</div>
                </td>
                <td className="px-4 py-3 font-mono text-label-md text-on-surface">{row.batchNo}</td>
                <td className="px-4 py-3 text-body-sm text-on-surface">{row.branch}</td>
                <td className="px-4 py-3 font-mono text-label-md text-on-surface tabular-nums">
                  {row.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-label-md text-on-surface">{row.expiryDate}</td>
                <td className="px-4 py-3">
                  <ExpiryBadge daysLeft={row.daysLeft} t={t} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="font-mono text-label-md text-primary-container border border-primary-container px-2 py-1 hover:bg-surface-container-high transition-colors uppercase">
                    {t("inv.transfer")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
