import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve('C:/Users/hp/Documents/cervos/WeeklyVioletAnalysts');

const env = {};
try {
  const content = readFileSync(resolve(root, '.env.local'), 'utf-8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

console.log('=== HQ CONSOLE SCHEMA CHECK ===\n');

console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
console.log('Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check storage buckets
async function checkStorage() {
  const { data, error } = await supabase.storage.listBuckets();
  return { buckets: data?.map(b => b.name) || [], error: error?.message || null };
}

// Check a table and get its columns
async function checkTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  return {
    table: tableName,
    error: error?.message || null,
    columns: error ? null : Object.keys(data?.[0] || {})
  };
}

async function checkColumn(tableName, columnName) {
  const { data, error } = await supabase.from(tableName).select(columnName).limit(1);
  return { table: tableName, column: columnName, error: error?.message || null };
}

async function main() {
  // Check storage buckets first
  console.log('\n--- Storage Buckets ---');
  const storage = await checkStorage();
  if (storage.error) {
    console.log(`Storage error: ${storage.error}`);
  } else {
    console.log(`Buckets found: ${storage.buckets.length > 0 ? storage.buckets.join(', ') : '(none)'}`);
    if (storage.buckets.length === 0) {
      console.log('WARNING: No storage buckets! Create "app-releases" bucket for file uploads.');
    }
  }

  // Tables referenced in hq.ts and pharmacy.ts
  const tables = [
    'accounts', 'branches', 'pharmacies', 'suppliers', 'plans', 'payments', 'invites',
    'quote_requests', 'hq_admins', 'operators', 'installs', 'user_profiles',
    'activity_log', 'sales', 'batches', 'products', 'support_tickets',
    'subscription_plans', 'billing_payments', 'news_posts', 'app_releases',
    'supplier_invites', 'supplier_quote_answers', 'order_line_items', 'orders'
  ];

  console.log('\n--- Tables ---');
  const uniqueTables = [...new Set(tables)];
  const results = [];
  for (const table of uniqueTables) {
    const result = await checkTable(table);
    results.push(result);
  }

  const missingTables = [];
  for (const r of results) {
    if (r.error) {
      missingTables.push(r.table);
      console.log(`MISSING: ${r.table} - ${r.error}`);
    } else {
      console.log(`EXISTS:  ${r.table}`);
      console.log(`         columns: ${r.columns.join(', ')}`);
    }
  }

  console.log('\n--- Critical Missing Tables ---');
  const criticalTables = ['user_profiles', 'subscription_plans', 'billing_payments', 'supplier_invites', 'supplier_quote_answers', 'news_posts'];
  for (const t of criticalTables) {
    if (missingTables.includes(t)) {
      console.log(`MISSING: ${t} - Required for HQ Console`);
    }
  }

  // Check specific columns that are referenced in queries
  console.log('\n--- Column Checks ---');
  const columnChecks = [
    { table: 'accounts', column: 'suspended_at', critical: true },
    { table: 'accounts', column: 'suspension_reason', critical: false },
    { table: 'accounts', column: 'subscription_plan', critical: true },
    { table: 'accounts', column: 'ltv', critical: false },
    { table: 'accounts', column: 'subscription_started_at', critical: false },
    { table: 'branches', column: 'locked_manually_at', critical: false },
    { table: 'batches', column: 'expiry_date', critical: true },
    { table: 'batches', column: 'expires_at', critical: false },
    { table: 'products', column: 'stock', critical: false },
    { table: 'sales', column: 'account_id', critical: false },
    { table: 'activity_log', column: 'account_id', critical: false },
  ];

  const missingColumns = [];
  for (const check of columnChecks) {
    const result = await checkColumn(check.table, check.column);
    if (result.error) {
      missingColumns.push(`${check.table}.${check.column}`);
      console.log(`MISSING: ${check.table}.${check.column}${check.critical ? ' [CRITICAL]' : ''}`);
    } else {
      console.log(`EXISTS:  ${check.table}.${check.column}`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Missing tables: ${missingTables.length}`);
  console.log(`Missing columns: ${missingColumns.length}`);

  if (missingTables.length > 0 || missingColumns.length > 0) {
    console.log('\nRun scripts/hq_schema_requirements.sql in Supabase SQL Editor to fix.');
  }
}

main().catch(console.error);
