/**
 * @file scripts/seed.mjs
 * @description Development seed script — creates test data in Supabase for local development.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Environment (reads from .env.local or process.env):
 *   SUPABASE_SERVICE_ROLE_KEY — service role key for admin access
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
 *
 * Creates:
 *   - HQ admin account (cervospharma@gmail.com)
 *   - A pharmacy account with 2 branches
 *   - 3 operators (1 admin, 2 operators) with PINs hashed
 *   - Sample products and batches
 *   - A supplier account with catalog products
 *   - A sample order
 */

import { createClient } from "@supabase/supabase-js";
import { scryptSync, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local not found, rely on process.env
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hashHQPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

async function createAuthUser(email, password, metadata) {
  // Try to get existing user first
  const { data: existing } = await supabase.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === email);
  if (existingUser) {
    console.log(`  User ${email} already exists, skipping create`);
    return existingUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) {
    console.error("Auth user creation error:", error);
    throw error;
  }
  return data.user;
}

async function seed() {
  console.log("Starting seed...\n");

  // 0. Create HQ admin (upsert)
  console.log("Creating HQ admin...");
  const { error: hqError } = await supabase.from("hq_admins").upsert({
    email: "cervospharma@gmail.com",
    name: "CervoPharma HQ",
    password_hash: hashHQPassword("threebodyproblem"),
    role: "admin",
  }, { onConflict: "email" });
  if (hqError) {
    console.error("HQ admin error:", hqError.message);
  } else {
    console.log("  HQ admin ready: cervospharma@gmail.com / threebodyproblem");
  }

  // 1. Create pharmacy auth user
  console.log("Creating pharmacy auth user...");
  const pharmacyUser = await createAuthUser("cervospharma@gmail.com", "threebodyproblem", { name: "CervoPharma Pharmacy" });
  console.log(`  Pharmacy user created: ${pharmacyUser.id}`);

  // 2. Create pharmacy account
  console.log("Creating pharmacy account...");
  const { data: pharmacyAccount, error: pharmacyAcctError } = await supabase
    .from("accounts")
    .insert({
      auth_user_id: pharmacyUser.id,
      name: "Test Pharmacy Ltd",
      type: "pharmacy",
      billing_status: "active",
    })
    .select()
    .single();

  if (pharmacyAcctError) {
    console.error("Pharmacy account error:", pharmacyAcctError);
    throw pharmacyAcctError;
  }
  console.log(`  Pharmacy account created: ${pharmacyAccount.id}`);

  // 3. Create branches
  console.log("Creating branches...");
  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .insert([
      {
        account_id: pharmacyAccount.id,
        name: "Branch 1 - Mwenge",
        address: "Plot 123, Mwenge Street, Dar es Salaam",
        lat: -6.816,
        lng: 39.280,
        subscription_status: "active",
      },
      {
        account_id: pharmacyAccount.id,
        name: "Branch 2 - Mikocheni",
        address: "Plot 456, Mikocheni B, Dar es Salaam",
        lat: -6.808,
        lng: 39.265,
        subscription_status: "active",
      },
    ])
    .select();

  if (branchesError) {
    console.error("Branches error:", branchesError);
    throw branchesError;
  }
  console.log(`  Created ${branches.length} branches`);

  // 4. Create operators
  console.log("Creating operators...");
  const pinHash1 = await hashPin("1234");
  const pinHash2 = await hashPin("5678");
  const pinHash3 = await hashPin("9999");

  const { error: opsError } = await supabase.from("operators").insert([
    {
      branch_id: branches[0].id,
      name: "John Admin",
      pin_hash: pinHash1,
      role: "admin",
    },
    {
      branch_id: branches[0].id,
      name: "Jane Operator",
      pin_hash: pinHash2,
      role: "operator",
    },
    {
      branch_id: branches[1].id,
      name: "Bob Operator",
      pin_hash: pinHash3,
      role: "operator",
    },
  ]);

  if (opsError) {
    console.error("Operators error:", opsError);
    throw opsError;
  }
  console.log("  Created 3 operators");

  // 5. Create products
  console.log("Creating products...");
  const { data: products, error: productsError } = await supabase
    .from("products")
    .insert([
      {
        generic_name: "Amoxicillin 500mg",
        brand_name: "Amoxil",
        category: "Antibiotics",
        requires_prescription: true,
      },
      {
        generic_name: "Metformin 850mg",
        brand_name: "Glucophage",
        category: "Antidiabetic",
        requires_prescription: true,
      },
      {
        generic_name: "Paracetamol 500mg",
        brand_name: "Panadol",
        category: "Analgesics",
        requires_prescription: false,
      },
      {
        generic_name: "ORS Sachets",
        brand_name: "Oral Rehydration Salts",
        category: "Vitamins",
        requires_prescription: false,
      },
      {
        generic_name: "Ibuprofen 400mg",
        brand_name: "Brufen",
        category: "Analgesics",
        requires_prescription: false,
      },
    ])
    .select();

  if (productsError) {
    console.error("Products error:", productsError);
    throw productsError;
  }
  console.log(`  Created ${products.length} products`);

  // 6. Create batches
  console.log("Creating batches...");
  const futureDate1 = new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0];
  const futureDate2 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
  const futureDate3 = new Date(Date.now() + 20 * 86400000).toISOString().split("T")[0];

  const { error: batchesError } = await supabase.from("batches").insert([
    {
      branch_id: branches[0].id,
      product_id: products[0].id,
      quantity: 500,
      expiry_date: futureDate1,
      batch_number: "AMX-001",
      cost_price: 500,
      sale_price: 800,
    },
    {
      branch_id: branches[0].id,
      product_id: products[1].id,
      quantity: 300,
      expiry_date: futureDate1,
      batch_number: "MET-001",
      cost_price: 1200,
      sale_price: 1800,
    },
    {
      branch_id: branches[0].id,
      product_id: products[2].id,
      quantity: 1000,
      expiry_date: futureDate2,
      batch_number: "PAR-001",
      cost_price: 200,
      sale_price: 350,
    },
    {
      branch_id: branches[1].id,
      product_id: products[2].id,
      quantity: 800,
      expiry_date: futureDate2,
      batch_number: "PAR-002",
      cost_price: 200,
      sale_price: 350,
    },
    {
      branch_id: branches[1].id,
      product_id: products[3].id,
      quantity: 200,
      expiry_date: futureDate3,
      batch_number: "ORS-001",
      cost_price: 100,
      sale_price: 180,
    },
    {
      branch_id: branches[0].id,
      product_id: products[4].id,
      quantity: 400,
      expiry_date: futureDate1,
      batch_number: "IBU-001",
      cost_price: 400,
      sale_price: 650,
    },
  ]);

  if (batchesError) {
    console.error("Batches error:", batchesError);
    throw batchesError;
  }
  console.log("  Created 6 batches");

  // 7. Create supplier auth user and account
  console.log("Creating supplier account...");
  const supplierUser = await createAuthUser("supplier@pharmacorp.com", "password123", { name: "PharmaCo Ltd" });

  const { data: supplierAccount, error: supplierAcctError } = await supabase
    .from("accounts")
    .insert({
      auth_user_id: supplierUser.id,
      name: "PharmaCo Ltd",
      type: "supplier",
      billing_status: "active",
    })
    .select()
    .single();

  if (supplierAcctError) {
    console.error("Supplier account error:", supplierAcctError);
    throw supplierAcctError;
  }
  console.log(`  Supplier account created: ${supplierAccount.id}`);

  // 8. Create supplier profile
  const { error: supplierProfileError } = await supabase.from("suppliers").insert({
    id: supplierAccount.id,
    email: "supplier@pharmacorp.com",
    company_name: "PharmaCo Ltd",
    subscription_status: "active",
  });

  if (supplierProfileError) {
    console.error("Supplier profile error:", supplierProfileError);
    // Non-fatal, continue
  }
  console.log("  Supplier profile created");

  // 9. Create catalog products for supplier
  console.log("Creating supplier catalog...");
  const { error: catalogError } = await supabase.from("catalog_products").insert([
    {
      supplier_id: supplierAccount.id,
      product_id: products[0].id,
      unit_price: 750,
      min_order_quantity: 50,
      lead_time_days: 7,
      pack_size: "100 tablets",
      in_stock: true,
    },
    {
      supplier_id: supplierAccount.id,
      product_id: products[1].id,
      unit_price: 1700,
      min_order_quantity: 30,
      lead_time_days: 5,
      pack_size: "100 tablets",
      in_stock: true,
    },
    {
      supplier_id: supplierAccount.id,
      product_id: products[2].id,
      unit_price: 300,
      min_order_quantity: 100,
      lead_time_days: 3,
      pack_size: "1000 tablets",
      in_stock: true,
    },
  ]);

  if (catalogError) {
    console.error("Catalog error:", catalogError);
    // Non-fatal, continue
  }
  console.log("  Supplier catalog created");

  // 10. Create a sample order
  console.log("Creating sample order...");
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      account_id: pharmacyAccount.id,
      supplier_id: supplierAccount.id,
      status: "delivered",
      total: 45000,
    })
    .select()
    .single();

  if (orderError) {
    console.error("Order error:", orderError);
    throw orderError;
  }
  console.log(`  Order created: ${order.id}`);

  // 11. Create order items
  const { error: orderItemsError } = await supabase.from("order_items").insert([
    {
      order_id: order.id,
      product_id: products[0].id,
      quantity: 50,
      unit_price: 750,
    },
    {
      order_id: order.id,
      product_id: products[1].id,
      quantity: 10,
      unit_price: 1700,
    },
  ]);

  if (orderItemsError) {
    console.error("Order items error:", orderItemsError);
    throw orderItemsError;
  }
  console.log("  Order items created");

  console.log("\nSeed completed successfully!");
  console.log("\nHQ Console: cervospharma@gmail.com / threebodyproblem");
  console.log("\nPharmacy (web): cervospharma@gmail.com / threebodyproblem");
  console.log("Supplier (web): supplier@pharmacorp.com / password123");
  console.log("\nOperator PINs:");
  console.log("  John Admin: 1234 (admin)");
  console.log("  Jane Operator: 5678 (operator)");
  console.log("  Bob Operator: 9999 (operator)");
}

seed().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
