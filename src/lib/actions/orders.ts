"use server";

import { createClient } from "@/lib/supabase/server";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: { generic_name: string; brand_name: string | null } | null;
}

export interface Order {
  id: string;
  account_id: string;
  supplier_id: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  created_at: string;
  suppliers?: { company_name: string } | null;
}

export interface OrderDetail extends Order {
  order_items: (OrderItem & { products: { generic_name: string; brand_name: string | null } | null })[];
}

export async function getOrders(accountId: string): Promise<Order[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, account_id, supplier_id, status, total, created_at, suppliers(company_name)"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as Order[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, account_id, supplier_id, status, total, created_at, suppliers(company_name)")
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, quantity, unit_price, products(generic_name, brand_name)")
    .eq("order_id", orderId);

  return {
    ...(order as unknown as Order),
    order_items: (items ?? []) as unknown as OrderDetail["order_items"],
  };
}
