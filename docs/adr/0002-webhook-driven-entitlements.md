# ADR 0002: Verified events drive financially derived entitlements

## Status

Accepted — 2026-08-26

## Decision

Browser redirects never grant access. Provider-originated financial changes enter through signature-verified webhooks or explicit provider reconciliation. Processing is idempotent, asynchronous, order-tolerant, retryable, and auditable.

The entitlement engine may also accept audited non-financial sources such as trials, migrations, promotions, support overrides, and administrator grants.

The system promises observable convergence, not guaranteed delivery or event order.

