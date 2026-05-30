-- ============================================================
-- RESERVATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS reservations (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  brand         TEXT NOT NULL,
  reference     TEXT NOT NULL,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id   TEXT REFERENCES locations(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  client        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'SOLICITADA'
                CHECK (status IN ('SOLICITADA','CONFIRMADA','LISTA','ENTREGADA','CANCELADA')),
  notes         TEXT,
  expires_at    TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for brand-filtered queries
CREATE INDEX IF NOT EXISTS idx_reservations_brand ON reservations(brand);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(brand, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_reservations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON reservations;
CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION touch_reservations_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role from profiles
-- (reuses the existing get_my_role() function already in the DB)

-- All authenticated users can read reservations for their brand
CREATE POLICY "reservations_select" ON reservations
  FOR SELECT USING (auth.role() = 'authenticated');

-- JEFE_ALMACEN and above can insert
CREATE POLICY "reservations_insert" ON reservations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ADMINISTRADOR and above can update (change status, edit fields)
CREATE POLICY "reservations_update" ON reservations
  FOR UPDATE USING (
    get_my_role() IN ('ADMIN_GENERAL','CEO','ADMINISTRADOR','JEFE_ALMACEN')
  );

-- Only CEO+ can hard-delete (soft cancel via status is preferred)
CREATE POLICY "reservations_delete" ON reservations
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL','CEO')
  );

-- ── Audit log trigger ─────────────────────────────────────────
-- Reuses the existing log_audit_event() function already in the DB
DROP TRIGGER IF EXISTS trg_audit_reservations ON reservations;
CREATE TRIGGER trg_audit_reservations
  AFTER INSERT OR UPDATE OR DELETE ON reservations
  FOR EACH ROW EXECUTE FUNCTION log_audit();
