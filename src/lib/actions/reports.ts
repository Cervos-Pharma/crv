"use server";

import { createClient } from "@/lib/supabase/server";

export interface SalesReport {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: TopProduct[];
  revenueByDay: RevenueByDay[];
}

export interface TopProduct {
  product_id: string;
  generic_name: string;
  brand_name: string | null;
  total_quantity: number;
  total_revenue: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  order_count: number;
}

export async function getSalesReport(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  branchId?: string
): Promise<SalesReport> {
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id")
    .eq("account_id", accountId);

  const branchIds = (branches ?? []).map((b) => b.id);
  const targetBranchIds = branchId && branchIds.includes(branchId) ? [branchId] : branchIds;

  if (targetBranchIds.length === 0) {
    return { totalRevenue: 0, orderCount: 0, averageOrderValue: 0, topProducts: [], revenueByDay: [] };
  }

  let query = supabase
    .from("sales")
    .select("total, created_at, branch_id, sale_items(quantity, unit_price, product_id, products(generic_name, brand_name))")
    .in("branch_id", targetBranchIds)
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo + "T23:59:59.999Z");

  const { data: salesData } = await query;

  const sales = (salesData ?? []) as unknown as Array<{
    total: number;
    created_at: string;
    branch_id: string;
    sale_items: Array<{
      quantity: number;
      unit_price: number;
      product_id: string;
      products: { generic_name: string; brand_name: string | null } | null;
    }>;
  }>;

  const totalRevenue = sales.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const orderCount = sales.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  const productMap = new Map<string, TopProduct>();
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.total_quantity += item.quantity;
        existing.total_revenue += item.quantity * item.unit_price;
      } else {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          generic_name: item.products?.generic_name ?? "Unknown",
          brand_name: item.products?.brand_name ?? null,
          total_quantity: item.quantity,
          total_revenue: item.quantity * item.unit_price,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);

  const dayMap = new Map<string, { revenue: number; order_count: number }>();
  for (const sale of sales) {
    const day = sale.created_at.split("T")[0];
    const existing = dayMap.get(day) ?? { revenue: 0, order_count: 0 };
    existing.revenue += sale.total ?? 0;
    existing.order_count += 1;
    dayMap.set(day, existing);
  }

  const revenueByDay: RevenueByDay[] = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split("T")[0];
    const dayData = dayMap.get(dayStr) ?? { revenue: 0, order_count: 0 };
    revenueByDay.push({ date: dayStr, ...dayData });
  }

  return { totalRevenue, orderCount, averageOrderValue, topProducts, revenueByDay };
}
