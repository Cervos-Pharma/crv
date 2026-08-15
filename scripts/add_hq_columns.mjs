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

console.log('Connecting to:', env.NEXT_PUBLIC_SUPABASE_URL);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Try to add columns via rpc
// Supabase exposes pg functions - let's try
try {
  // This will likely fail but let's see the error
  const { data, error } = await supabase.rpc('pg_catalog.pg_try_advisory_lock', { lockid: 1 });
  console.log('rpc test:', data, error?.message);
} catch (e) {
  console.log('rpc call error:', e.message);
}

// Check what's available
try {
  const { error } = await supabase.from('hq_admins').select('role,disabled,last_login_at').limit(1);
  console.log('select specific cols:', error?.message || 'OK');
} catch (e) {
  console.log('select error:', e.message);
}

// Try INSERT with all fields and see what happens
const { error: insertError } = await supabase.from('hq_admins').upsert({
  email: 'cervospharma@gmail.com',
  name: 'CervoPharma HQ',
  password_hash: 'test',
  role: 'admin',
  disabled: false,
  last_login_at: null,
}, { onConflict: 'email' });
console.log('upsert with extra cols:', insertError?.message || 'OK');

// Verify columns now
const { data, error: verifyError } = await supabase.from('hq_admins').select('*').limit(1);
console.log('columns after upsert:', Object.keys(data?.[0] || {}));
