BEGIN;

ALTER TABLE checkout_sessions
  ALTER COLUMN plan_key DROP NOT NULL,
  ADD COLUMN item_ref varchar(255) NULL,
  ADD COLUMN item_entitlement_key varchar(160) NULL,
  ADD COLUMN item_entitlement_scope jsonb NULL,
  ADD COLUMN checkout_target_type varchar(24) GENERATED ALWAYS AS (
    CASE
      WHEN item_ref IS NOT NULL THEN 'item'
      ELSE 'plan'
    END
  ) STORED,
  ADD CONSTRAINT checkout_sessions_exactly_one_target_chk CHECK (
    (plan_key IS NOT NULL AND item_ref IS NULL AND item_entitlement_key IS NULL AND item_entitlement_scope IS NULL)
    OR
    (plan_key IS NULL AND item_ref IS NOT NULL AND item_entitlement_key IS NOT NULL AND item_entitlement_scope IS NOT NULL)
  );

CREATE INDEX checkout_sessions_item_idx ON checkout_sessions (application_id, item_ref, environment, created_at DESC) WHERE item_ref IS NOT NULL;

CREATE TABLE item_entitlement_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_customer_id uuid NOT NULL REFERENCES payment_customers(id),
  item_ref varchar(255) NOT NULL,
  entitlement_key varchar(160) NOT NULL,
  entitlement_scope jsonb NOT NULL,
  status entitlement_status NOT NULL,
  source_type varchar(32) NOT NULL,
  source_reference varchar(255) NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (payment_customer_id, item_ref, entitlement_key, source_type, source_reference)
);

CREATE INDEX item_entitlement_evidence_customer_idx ON item_entitlement_evidence (payment_customer_id, item_ref, entitlement_key, effective_from DESC);

COMMIT;