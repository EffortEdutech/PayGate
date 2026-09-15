# Phase 7 Track 5E - Persistence Model for Item Checkout and Item Entitlement Evidence

Status: implemented; item checkout and item entitlement projection remain disabled.

## Objective

Prepare PayGate persistence for future pageCast Single Cast purchases by adding storage shape for item checkout intent and item entitlement evidence, without activating item checkout, Stripe item sessions, or item access grants.

## Implemented Scope

- Added optional item checkout fields to checkout session records:
  - `item_ref`
  - `item_entitlement_key`
  - `item_entitlement_scope`
- Kept existing plan checkout records supported through nullable `plan_key` plus an exact-one-target database check.
- Added `item_entitlement_evidence` table for future verified provider/reconciliation evidence.
- Added repository contract method `saveItemEntitlementEvidence(...)`.
- Implemented Postgres persistence for future item checkout intent and item entitlement evidence.
- Implemented in-memory persistence shape for tests/operator snapshots.
- Added tests proving item checkout intent and item evidence can be persisted separately from projected entitlements.

## Safety Boundary

This track does not:

- create Stripe item checkout sessions;
- process item webhooks into entitlements;
- grant item access;
- expose item checkout to pageCast users;
- mutate Stripe Product/Price catalog;
- authorize live item payments.

Item entitlement evidence is storage-only at this stage. `currentEntitlements(...)` continues to return only projected entitlements from the existing verified event/reconciliation flow.

## Database Changes

New migration:

- `payment-hub/database/migrations/0004_phase7_item_checkout_evidence.sql`

Migration summary:

- Makes `checkout_sessions.plan_key` nullable for future item checkout records.
- Adds item target fields to `checkout_sessions`.
- Adds generated `checkout_target_type` as `plan` or `item`.
- Adds a check constraint so checkout records are either plan-targeted or item-targeted, never both.
- Adds `item_entitlement_evidence` table for verified item evidence.

## Validation Evidence

- Targeted/full Node test run passed: 66 tests.
- Full `npm run check` must pass before final handoff.

## Next Track

Proceed to Phase 7 Track 5F - Webhook Projection for Item-Scoped Entitlements.