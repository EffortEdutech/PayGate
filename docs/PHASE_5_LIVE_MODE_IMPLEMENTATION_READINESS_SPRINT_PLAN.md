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

- [ ] Define live environment variable naming convention.
- [ ] Require provider account alias to be named company scope, not `primary`.
- [ ] Require separate live webhook secret per provider account.
- [ ] Require live account config to be complete before enabling live routes.
- [ ] Add diagnostics that show presence only, never values.

## Track 3 - Live Registry Strategy

Goal: represent live Product/Price lookup safely without exposing provider authority to apps.

Checklist:

- [ ] Decide whether test and live lookup keys are identical or explicitly separated.
- [ ] Validate live plan amount, currency, mode, and lookup key presence.
- [ ] Ensure app requests still cannot submit price IDs or amounts.
- [ ] Add registry validation for live readiness fields.

## Track 4 - Live Webhook Boundary

Goal: ensure live webhooks are signed, account-scoped, and environment-scoped.

Checklist:

- [ ] Confirm `/v1/webhooks/stripe/{provider_account}/live` path is supported only when live config exists.
- [ ] Verify live endpoint uses the live account webhook secret only.
- [ ] Add tests for wrong-account and wrong-environment webhook rejection.
- [ ] Confirm webhook inbox uniqueness includes provider account and environment.

## Track 5 - Refund Handling Policy and Event Mapping

Goal: define what PayGate does when Stripe reports a refund.

Checklist:

- [ ] Define full refund entitlement policy.
- [ ] Define partial refund entitlement policy.
- [ ] Define disputed/chargeback policy if applicable.
- [ ] Map Stripe refund/charge/dispute events into Hub events without exposing raw provider objects.
- [ ] Add tests for refund event normalization and entitlement outcome.

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
