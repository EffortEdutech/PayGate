# Phase 5 - Live-Mode Implementation Readiness Sprint Plan

Status: planned; implementation not started.
Parent product plan: `docs/PRODUCT_PLAN.md`.

## Objective

Design and implement an explicit live-mode boundary for PayGate so Stripe sandbox and Stripe live paths cannot mix accidentally. Phase 5 prepares the system for a future controlled live pilot, but it does not run live payments or refunds.

## Core Guardrail

Phase 5 may introduce live-mode code paths and configuration validation only after this sprint plan is accepted. Live credentials may be configured only in server-side secret storage. A real live checkout, live webhook entitlement mutation, live payment, or refund remains blocked until Phase 6 controlled live pilot approval.

## Track 1 - Live Adapter Boundary Design

Goal: separate sandbox and live adapter construction intentionally.

Checklist:

- [x] Define separate test and live Stripe adapter configuration types.
- [x] Prevent `sk_live_` from being used by sandbox adapter.
- [x] Prevent `sk_test_` from being used by live adapter.
- [x] Keep provider-neutral contracts unchanged.
- [x] Add tests for key/mode mismatch rejection.


Implementation notes:

- Added explicit `StripeTestAdapterConfig` and `StripeLiveAdapterConfig` types.
- Runtime construction remains sandbox-only and passes `environment: "test"` explicitly.
- Added `StripeLiveAdapterNotImplemented` as a live boundary placeholder that validates live key shape but inherits non-operational skeleton behavior.
- Provider-neutral contracts were not changed.
- Tests now prove sandbox rejects `sk_live_`, live boundary rejects `sk_test_`, and live runtime operations remain unavailable until an explicit live adapter is implemented.
## Track 2 - Live Provider Account Configuration Model

Goal: make live account aliases explicit and auditable.

Checklist:

- [x] Define live environment variable naming convention.
- [x] Require provider account alias to be named company scope, not `primary`.
- [x] Require separate live webhook secret per provider account.
- [x] Require live account config to be complete before enabling live routes.
- [x] Add diagnostics that show presence only, never values.


Implementation notes:

- Added separate live account list `STRIPE_LIVE_ACCOUNTS`.
- Added live secret names `STRIPE_LIVE_ACCOUNT_<ALIAS>_SECRET_KEY` and `STRIPE_LIVE_ACCOUNT_<ALIAS>_WEBHOOK_SECRET`.
- Live aliases named `primary` are rejected/ignored for runtime config and flagged by diagnostics.
- Live accounts are configured only when both live secret key and live webhook secret are present.
- Protected diagnostics expose live account aliases and presence/prefix checks only; secret values remain redacted.
## Track 3 - Live Registry Strategy

Goal: represent live Product/Price lookup safely without exposing provider authority to apps.

Checklist:

- [x] Decide whether test and live lookup keys are identical or explicitly separated.
- [x] Validate live plan amount, currency, mode, and lookup key presence.
- [x] Ensure app requests still cannot submit price IDs or amounts.
- [x] Add registry validation for live readiness fields.


Implementation notes:

- Added `docs/LIVE_REGISTRY_STRATEGY.md` as the operator rulebook for live Product/Price lookup keys.
- Added optional `live_lookup_key` per provider plan mapping.
- Live checkout resolution uses `live_lookup_key` when present and falls back to the existing `lookup_key` when live/test catalogs intentionally share lookup names.
- Registry validation now checks test and effective-live lookup uniqueness separately.
- Checkout tests prove caller-supplied provider price/account/amount fields do not override registry authority.

## Track 4 - Live Webhook Boundary

Goal: ensure live webhooks are signed, account-scoped, and environment-scoped.

Checklist:

- [x] Confirm `/v1/webhooks/stripe/{provider_account}/live` path is supported only when live config exists.
- [x] Verify live endpoint uses the live account webhook secret only.
- [x] Add tests for wrong-account and wrong-environment webhook rejection.
- [x] Confirm webhook inbox uniqueness includes provider account and environment.


Implementation notes:

- Added environment-scoped provider account routing using `{provider_account}:{environment}` adapter keys.
- Runtime now wires sandbox Stripe accounts to `:test` adapters and live Stripe accounts to `:live` webhook-only adapters.
- Added a live webhook-only Stripe adapter that verifies signed live webhook payloads using live keys while keeping checkout, portal, and reconciliation live operations unavailable.
- Added tests proving live webhook routes fail closed without live config and wrong account/environment combinations do not fall back across boundaries.
- Confirmed webhook inbox uniqueness already includes `provider_id`, `provider_account`, `environment`, and `provider_event_id`.

## Track 5 - Refund Handling Policy and Event Mapping

Goal: define what PayGate does when Stripe reports a refund.

Checklist:

- [x] Define full refund entitlement policy.
- [x] Define partial refund entitlement policy.
- [x] Define disputed/chargeback policy if applicable.
- [x] Map Stripe refund/charge/dispute events into Hub events without exposing raw provider objects.
- [x] Add tests for refund event normalization and entitlement outcome.


Implementation notes:

- Added `docs/REFUND_AND_CHARGEBACK_POLICY.md`.
- Added Hub event types `refund.full`, `refund.partial`, and `dispute.opened`.
- Mapped Stripe full `charge.refunded` events to entitlement revocation.
- Mapped Stripe partial refund events to processed/no automatic entitlement change.
- Mapped Stripe dispute/chargeback events to entitlement revocation.
- Updated repository projection logic so unknown/partial refund events cannot accidentally mark entitlement active.
- Added tests for Stripe refund/dispute normalization and entitlement projection outcomes.

## Track 6 - Live Operator Diagnostics and Admin Evidence

Goal: give the operator enough safe visibility before Phase 6.

Checklist:

- [ ] Show live/test environment clearly in admin summary.
- [ ] Show provider account alias and app mapping without secrets.
- [ ] Show live readiness diagnostics without credential values.
- [ ] Show webhook/reconciliation state by environment.
- [ ] Add evidence checklist link in docs/admin flow.

## Track 7 - Phase 6 Entry Gate

Goal: prepare a go/no-go decision for the controlled live pilot.

Checklist:

- [ ] `npm run check` passes.
- [ ] Phase 5 implementation evidence is recorded.
- [ ] Live-mode readiness checklist is updated.
- [ ] Controlled live payment/refund gate is reviewed.
- [ ] Operator approval is still required before Phase 6 execution.

## Stop Conditions

Stop and update the product plan before proceeding if Phase 5 requires any of these:

- changing frozen Phase 0 provider-neutral contracts;
- letting apps submit commercial authority fields;
- granting entitlements from redirects;
- exposing provider secrets or raw provider SDK objects;
- combining test and live credentials in one unchecked path;
- running a real live payment or refund.

## Explicitly Not Authorized In Phase 5

- No real live checkout execution.
- No real live payment.
- No real refund.
- No broad user rollout.
- No app #2 implementation unless the operator separately starts Phase 7 multi-app scale-out.

## Definition of Done

Phase 5 is complete only when:

- [ ] live-mode config and adapter boundaries are implemented and tested;
- [ ] refund policy is documented and tested at event/projection level;
- [ ] admin/diagnostics show safe live readiness state;
- [ ] full test suite passes;
- [ ] Phase 6 controlled live pilot remains separately approval-gated.
