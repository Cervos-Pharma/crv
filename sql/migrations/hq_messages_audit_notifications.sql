-- Migration: add hq_messages, hq_audit_log, and notifications tables
-- Run in Supabase Dashboard → SQL Editor

-- ── HQ Broadcast Messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hq_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  kind        TEXT        NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'warning', 'urgent', 'promo')),
  target_scope TEXT       NOT NULL DEFAULT 'all' CHECK (target_scope IN ('all', 'all_pharmacies', 'all_suppliers', 'account', 'branch')),
  target_account_id UUID   NULL,
  target_branch_id  UUID   NULL,
  created_by  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hq_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can READ messages
CREATE POLICY "hq_messages_read_all" ON hq_messages FOR SELECT USING (true);

-- Only service role can INSERT/DELETE (via server actions)
CREATE POLICY "hq_messages_insert_all" ON hq_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "hq_messages_delete_all" ON hq_messages FOR DELETE USING (true);

-- ── HQ Audit Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hq_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT        NOT NULL,
  entity_type TEXT        NULL,
  entity_id   UUID        NULL,
  detail      TEXT        NULL,
  admin_id    TEXT        NULL,
  admin_email TEXT        NULL,
  account_id  UUID        NULL,
  branch_id   UUID        NULL,
  ip_address  TEXT        NULL,
  user_agent  TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hq_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hq_audit_log_read_all"  ON hq_audit_log FOR SELECT USING (true);
CREATE POLICY "hq_audit_log_insert_all" ON hq_audit_log FOR INSERT WITH CHECK (true);

-- Index for fast search
CREATE INDEX IF NOT EXISTS hq_audit_log_action_idx     ON hq_audit_log (action);
CREATE INDEX IF NOT EXISTS hq_audit_log_entity_idx     ON hq_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS hq_audit_log_admin_idx      ON hq_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS hq_audit_log_created_idx    ON hq_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS hq_audit_log_account_idx    ON hq_audit_log (account_id) WHERE account_id IS NOT NULL;

-- ── Notifications (for pharmacies & suppliers to poll) ─────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NULL,
  branch_id   UUID        NULL,
  kind        TEXT        NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'warning', 'urgent', 'promo', 'system')),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  route       TEXT        NULL,
  action      TEXT        NULL,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own account/branch notifications
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM accounts WHERE auth_user_id = auth.uid()
    )
    OR branch_id IN (
      SELECT b.id FROM branches b JOIN accounts a ON b.account_id = a.id WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS notifications_account_idx ON notifications (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_branch_idx  ON notifications (branch_id)  WHERE branch_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);
