BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE payment_environment AS ENUM ('test', 'live');
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'processed', 'retryable', 'dead_letter');
CREATE TYPE entitlement_status AS ENUM ('active', 'inactive', 'grace', 'expired', 'revoked');

CREATE TABLE payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id varchar(64) NOT NULL UNIQUE,
  registry_version varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES payment_applications(id),
  app_user_ref varchar(128) NOT NULL,
  global_customer_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, app_user_ref)
);

CREATE TABLE provider_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_customer_id uuid NOT NULL REFERENCES payment_customers(id),
  provider_id varchar(32) NOT NULL,
  provider_account varchar(64) NOT NULL,
  environment payment_environment NOT NULL,
  provider_customer_ref varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_account, environment, provider_customer_ref),
  UNIQUE (payment_customer_id, provider_id, provider_account, environment)
);

CREATE TABLE webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id varchar(32) NOT NULL,
  provider_account varchar(64) NOT NULL,
  environment payment_environment NOT NULL,
  provider_event_id varchar(255) NOT NULL,
  provider_created_at timestamptz NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  payload_sha256 char(64) NOT NULL,
  status processing_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner varchar(128) NULL,
  lease_expires_at timestamptz NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  last_error_code varchar(64) NULL,
  last_error_detail text NULL,
  UNIQUE (provider_id, provider_account, environment, provider_event_id)
);

CREATE TABLE entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_customer_id uuid NOT NULL REFERENCES payment_customers(id),
  entitlement_key varchar(160) NOT NULL,
  status entitlement_status NOT NULL,
  source_type varchar(32) NOT NULL,
  source_reference varchar(255) NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz NULL,
  supersedes_grant_id uuid NULL REFERENCES entitlement_grants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES payment_applications(id),
  operation varchar(80) NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  request_sha256 char(64) NOT NULL,
  status varchar(24) NOT NULL,
  response_status integer NULL,
  response_body jsonb NULL,
  lease_owner varchar(128) NULL,
  lease_expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (application_id, operation, idempotency_key)
);

CREATE TABLE event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  target_app_id varchar(64) NOT NULL,
  event_type varchar(120) NOT NULL,
  aggregate_type varchar(64) NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  payload jsonb NOT NULL,
  status processing_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz NULL,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
);

CREATE TABLE payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type varchar(32) NOT NULL,
  actor_id varchar(255) NOT NULL,
  action varchar(120) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id varchar(255) NOT NULL,
  reason_code varchar(64) NULL,
  request_id varchar(128) NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX webhook_inbox_work_idx ON webhook_inbox (status, next_attempt_at);
CREATE INDEX entitlement_grants_customer_idx ON entitlement_grants (payment_customer_id, entitlement_key, effective_from DESC);
CREATE INDEX event_outbox_work_idx ON event_outbox (status, next_attempt_at);

COMMIT;
