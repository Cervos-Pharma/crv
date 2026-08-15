import { Fe, Pe, Et } from './database'
import type { Operator, Branch } from '../types'

export async function fetchOperator(id: string): Promise<Operator | null> {
  const results = await Fe('SELECT * FROM operators WHERE id = ?', [id])
  return results.length > 0 ? results[0] : null
}

export async function fetchOperators(branchId: string): Promise<Operator[]> {
  return Fe('SELECT * FROM operators WHERE branch_id = ? ORDER BY name', [branchId])
}

export async function validateOperatorPin(branchId: string, pin: string): Promise<Operator | null> {
  const results = await Fe('SELECT * FROM operators WHERE branch_id = ?', [branchId])
  for (const op of results) {
    const hash = await hashPin(pin)
    if (op.pin_hash === hash) {
      return op
    }
  }
  return null
}

export async function createOperator(data: {
  branch_id: string
  name: string
  pin: string
  role: 'admin' | 'operator'
}): Promise<Operator> {
  const id = Et()
  const pinHash = await hashPin(data.pin)
  await Pe(
    'INSERT INTO operators (id, branch_id, name, pin_hash, role, created_at) VALUES (?,?,?,?,?,?)',
    [id, data.branch_id, data.name, pinHash, data.role, new Date().toISOString()]
  )
  return { id, branch_id: data.branch_id, name: data.name, pin_hash: pinHash, role: data.role, created_at: new Date().toISOString() }
}

export async function updateOperator(id: string, data: { name?: string; pin?: string; role?: 'admin' | 'operator' }): Promise<void> {
  if (data.name !== undefined) {
    await Pe('UPDATE operators SET name = ? WHERE id = ?', [data.name, id])
  }
  if (data.pin !== undefined) {
    const hash = await hashPin(data.pin)
    await Pe('UPDATE operators SET pin_hash = ? WHERE id = ?', [hash, id])
  }
  if (data.role !== undefined) {
    await Pe('UPDATE operators SET role = ? WHERE id = ?', [data.role, id])
  }
}

export async function deleteOperator(id: string): Promise<void> {
  await Pe('DELETE FROM operators WHERE id = ?', [id])
}

export async function fetchBranch(id: string): Promise<Branch | null> {
  const results = await Fe('SELECT * FROM branches WHERE id = ?', [id])
  return results.length > 0 ? results[0] : null
}

export async function fetchBranchSubscription(branchId: string): Promise<{
  subscription_status: string
  subscription_tier: string
  grace_ends_at: string | null
} | null> {
  const results = await Fe('SELECT subscription_status, subscription_tier, grace_ends_at FROM branches WHERE id = ?', [branchId])
  if (results.length === 0) return null
  const b = results[0]
  return {
    subscription_status: b.subscription_status || 'trial',
    subscription_tier: b.subscription_tier || 'free',
    grace_ends_at: b.grace_ends_at || null,
  }
}

export async function updateBranchSubscription(branchId: string, data: {
  subscription_status?: string
  subscription_tier?: string
  grace_ends_at?: string
}): Promise<void> {
  if (data.subscription_status !== undefined) {
    await Pe('UPDATE branches SET subscription_status = ? WHERE id = ?', [data.subscription_status, branchId])
  }
  if (data.subscription_tier !== undefined) {
    await Pe('UPDATE branches SET subscription_tier = ? WHERE id = ?', [data.subscription_tier, branchId])
  }
  if (data.grace_ends_at !== undefined) {
    await Pe('UPDATE branches SET grace_ends_at = ? WHERE id = ?', [data.grace_ends_at, branchId])
  }
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
