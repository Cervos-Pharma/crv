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

console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
console.log('Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from('hq_admins').select('*').limit(1);
console.log('columns:', Object.keys(data?.[0] || {}));
console.log('select * error:', error?.message);

const { data: admins, error: listError } = await supabase.from('hq_admins').select('email');
console.log('admins:', JSON.stringify(admins), 'error:', listError?.message);
