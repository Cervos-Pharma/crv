-- Migration: branch_commands table for HQ → Desktop command queue
-- Run this migration in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS branch_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  command TEXT NOT NULL, -- 'lock_branch' | 'unlock_branch' | 'suspend_branch' | 'force_sync'
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

-- Index for fast lookup by branch + status
CREATE INDEX IF NOT EXISTS idx_branch_commands_branch_status
  ON branch_commands(branch_id, status)
  WHERE status = 'pending';

-- Index for HQ to see pending commands by account
CREATE INDEX IF NOT EXISTS idx_branch_commands_account_status
  ON branch_commands(account_id, status)
  WHERE status = 'pending';

-- Add locked_reason column to branches if not exists
-- This is already referenced in code but schema may not have it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'locked_reason'
  ) THEN
    ALTER TABLE branches ADD COLUMN locked_reason TEXT;
  END IF;
END $$;
