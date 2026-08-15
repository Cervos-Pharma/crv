import { supabase, isConfigured } from './supabase'
import { Fe, Pe, Et, Mt } from './database'
import type { DashboardStats } from '../types'

let Ie: any = null
const SESSION_KEY = 'cervos_supabase_session'

async function saveSession(session: any): Promise<void> {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

async function loadSession(): Promise<any> {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  }
  return null
}

export async function Xd(n: string, t: string): Promise<void> {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [n, JSON.stringify(t)]
  )
}

export async function q0(n: string): Promise<string | null> {
  const result = await Fe(
    'SELECT value FROM app_settings WHERE key = ?',
    [`last_pull_${n}`]
  )
  return result.length > 0 ? result[0].value : null
}

export async function K0(n: string, t: string): Promise<void> {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [`last_pull_${n}`, t]
  )
}

export async function Z8(): Promise<boolean> {
  if (!isConfigured) return false
  const storedSession = await loadSession()
  if (storedSession) {
    Ie = supabase
    const { data } = await Ie.auth.getSession()
    if (!data.session) {
      Ie = null
      await saveSession(null)
      return false
    }
    return true
  }
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    Ie = supabase
    await saveSession(data.session)
    return true
  }
  return false
}

export async function Nd(
  n: string,
  t: string
): Promise<void> {
  if (!isConfigured) throw new Error('Supabase is not configured yet.')
  Ie = supabase
  const { error, data } = await Ie.auth.signInWithPassword({
    email: n,
    password: t,
  })
  if (error) {
    Ie = null
    throw new Error(error.message)
  }
  if (data.session) {
    await saveSession(data.session)
  }
}

export async function Pd(): Promise<void> {
  if (!Ie) throw new Error('Not linked to Supabase.')
  const { data: user } = await Ie.auth.getUser()
  if (!user.user) return

  const { data: account } = await Ie
    .from('accounts')
    .select('id')
    .eq('auth_user_id', user.user.id)
    .maybeSingle()

  if (!account) return

  const nameResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_name'")
  const latResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_lat'")
  const lngResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_lng'")
  const addressResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_address'")
  const phoneResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_phone'")
  const emailResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_email'")

  const centreName = nameResult.length > 0 ? JSON.parse(nameResult[0].value) : 'My Pharmacy'
  const lat = latResult.length > 0 && latResult[0].value !== 'null' ? JSON.parse(latResult[0].value) : null
  const lng = lngResult.length > 0 && lngResult[0].value !== 'null' ? JSON.parse(lngResult[0].value) : null
  const address = addressResult.length > 0 ? JSON.parse(addressResult[0].value) : ''
  const phone = phoneResult.length > 0 ? JSON.parse(phoneResult[0].value) : ''
  const email = emailResult.length > 0 ? JSON.parse(emailResult[0].value) : ''

  const branchId = Et()
  const trialEndsAt = new Date(Date.now() + 7 * 86400000).toISOString()

  await Ie.from('branches').insert({
    id: branchId,
    account_id: account.id,
    name: centreName,
    address: address,
    phone: phone,
    email: email,
    lat: lat,
    lng: lng,
    subscription_status: 'trial',
    trial_ends_at: trialEndsAt,
  })

  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['branch_id', JSON.stringify(branchId)]
  )

  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['account_id', JSON.stringify(account.id)]
  )
}

export async function tp(): Promise<void> {
  try {
    await Ie?.auth.signOut()
  } catch (e) {
    console.error('Sign out error:', e)
  }
  Ie = null
  await saveSession(null)
}

export async function np(): Promise<DashboardStats> {
  const linked = await Z8()
  const pendingResult = await Fe('SELECT COUNT(*) AS c FROM sync_queue')
  const pendingCount = pendingResult[0]?.c ?? 0
  const lastSyncResult = await Fe(
    "SELECT value FROM app_settings WHERE key = 'last_synced_at'"
  )
  const lastSyncedAt = lastSyncResult[0]?.value ?? null

  return {
    linked,
    pendingCount,
    lastSyncedAt,
    isSyncing: false,
  }
}

export async function sp(n: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(n)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function Wf(): Promise<void> {
  const isLinked = await Z8()
  if (isLinked) {
    await Pd()
  }
}

export async function qs(tableName: string, rowId: string, operation: string, payload: any): Promise<void> {
  const id = Et()
  await Pe(
    `INSERT INTO sync_queue (id, table_name, row_id, operation, payload, created_at, attempts) VALUES (?,?,?,?,?,?,?)`,
    [id, tableName, rowId, operation, JSON.stringify(payload), Mt(), 0]
  )
}

export async function zf(): Promise<boolean> {
  const result = await Fe("SELECT value FROM app_settings WHERE key = 'pharmacy_name'")
  return result.length > 0
}

export function getSupabase() {
  return Ie || supabase
}

export async function syncSubscription(branchId: string): Promise<void> {
  if (!Ie || !isConfigured) return

  try {
    const { data: branch } = await Ie
      .from('branches')
      .select('subscription_status, subscription_tier, grace_ends_at, trial_ends_at')
      .eq('id', branchId)
      .maybeSingle()

    if (branch) {
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['subscription_status', JSON.stringify(branch.subscription_status)]
      )
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['subscription_tier', JSON.stringify(branch.subscription_tier)]
      )
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['grace_ends_at', JSON.stringify(branch.grace_ends_at)]
      )
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['trial_ends_at', JSON.stringify(branch.trial_ends_at)]
      )
    }
  } catch (error) {
    console.error('Failed to sync subscription:', error)
  }
}

export async function checkSubscriptionBlocked(): Promise<{ blocked: boolean; reason?: string }> {
  const statusResult = await Fe("SELECT value FROM app_settings WHERE key = 'subscription_status'")
  const graceResult = await Fe("SELECT value FROM app_settings WHERE key = 'grace_ends_at'")

  const status = statusResult.length > 0 ? JSON.parse(statusResult[0].value) : 'trial'

  if (status === 'inactive') {
    if (graceResult.length > 0) {
      const graceEndsAt = JSON.parse(graceResult[0].value)
      if (graceEndsAt && new Date() > new Date(graceEndsAt)) {
        return { blocked: true, reason: 'Subscription grace period has expired' }
      }
    }
    return { blocked: true, reason: 'Subscription is inactive' }
  }

  if (status === 'past_due') {
    return { blocked: true, reason: 'Subscription payment is past due' }
  }

  return { blocked: false }
}

export async function processSyncQueue(): Promise<{ uploaded: number; failed: number }> {
  if (!Ie) return { uploaded: 0, failed: 0 }

  const queue = await Fe('SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50')
  let uploaded = 0
  let failed = 0

  for (const item of queue) {
    try {
      const payload = JSON.parse(item.payload)
      const { table_name, row_id, operation } = item

      if (operation === 'insert') {
        const { error } = await Ie.from(table_name).insert(payload)
        if (!error) {
          await Fe('DELETE FROM sync_queue WHERE id = ?', [item.id])
          uploaded++
        } else {
          failed++
        }
      } else if (operation === 'update') {
        const { error } = await Ie.from(table_name).update(payload).eq('id', row_id)
        if (!error) {
          await Fe('DELETE FROM sync_queue WHERE id = ?', [item.id])
          uploaded++
        } else {
          failed++
        }
      } else if (operation === 'delete') {
        const { error } = await Ie.from(table_name).delete().eq('id', row_id)
        if (!error) {
          await Fe('DELETE FROM sync_queue WHERE id = ?', [item.id])
          uploaded++
        } else {
          failed++
        }
      }
    } catch {
      failed++
    }
  }

  if (uploaded > 0) {
    await Pe(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['last_synced_at', JSON.stringify(new Date().toISOString())]
    )
  }

  return { uploaded, failed }
}
