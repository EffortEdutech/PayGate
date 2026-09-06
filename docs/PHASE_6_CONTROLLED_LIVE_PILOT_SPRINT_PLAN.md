# Phase 6 - Controlled Live Pilot Sprint Plan

Status: documentation preparation in progress; not authorized for live execution.
Parent product plan: `docs/PRODUCT_PLAN.md`.
Related gate: `docs/CONTROLLED_LIVE_PAYMENT_REFUND_GATE.md`.
Related approval template: `docs/PHASE_6_LIVE_PILOT_APPROVAL_TEMPLATE.md`.
Related evidence log: `docs/PHASE_6_LIVE_PILOT_EVIDENCE_LOG_TEMPLATE.md`.

## Objective

Run one narrow, operator-approved, low-value live Stripe payment and optional refund pilot to prove PayGate can process real money safely for one app, one known user, one company-owned Stripe account, and one approved plan.

Phase 6 is the first phase where real money may be used, but only after explicit operator approval is recorded outside source control.

## Core Guardrail

Phase 6 does not start automatically when Phase 5 is complete. It starts only after the operator approves a specific live test window with app, provider account, amount, user, payment method, refund policy, evidence location, and rollback/support owner.

As of 2026-09-07, Phase 5 is accepted and frozen. The next permitted work is documentation and preflight planning only. Live execution remains locked until the approval packet is completed outside source control.

## Track 1 - Live Pilot Approval Packet

Goal: make the live pilot bounded before any real transaction.

Checklist:

- [x] Create approval record template.
- [x] Create evidence log template.
- [ ] Complete the approval record outside source control.
- [ ] Confirm app name and production URL.
- [ ] Confirm company/legal Stripe account owner.
- [ ] Confirm provider account alias and Stripe account ID.
- [ ] Confirm plan key, amount, currency, and checkout mode.
- [ ] Confirm operator-controlled test user/customer email.
- [ ] Confirm refund test: full, partial, or none.
- [ ] Confirm support/rollback owner.
- [ ] Confirm evidence storage location outside source control.

## Track 2 - Preflight Verification

Goal: verify the deployed system is ready before creating live checkout.

Checklist:

- [ ] Confirm PayGate deployment commit SHA.
- [ ] Confirm PayGate `/health` is healthy.
- [ ] Confirm protected diagnostics require operator token.
- [ ] Confirm admin console requires operator token.
- [ ] Confirm monitoring has no unresolved critical alerts.
- [ ] Confirm live provider account config exists server-side only.
- [ ] Confirm live webhook endpoint exists and uses the correct provider account alias.
- [ ] Confirm registry live mapping matches approved plan.
- [ ] Confirm database backup/restore readiness.

## Track 3 - Live Checkout Pilot

Goal: create and complete exactly one approved live checkout.

Checklist:

- [ ] Create checkout from the production app for the approved user.
- [ ] Confirm Stripe checkout shows the approved company/account branding.
- [ ] Confirm amount and currency match approval exactly.
- [ ] Complete payment using approved payment method.
- [ ] Record checkout session ID safely.
- [ ] Record payment intent/charge ID safely.
- [ ] Do not run any second live checkout unless separately approved.

## Track 4 - Live Webhook and Entitlement Proof

Goal: prove entitlement changes come from verified live evidence only.

Checklist:

- [ ] Confirm signed live webhook received.
- [ ] Confirm webhook event ID and processed status.
- [ ] Confirm entitlement/subscription projection changed only after verified webhook.
- [ ] Confirm browser redirect alone did not grant entitlement.
- [ ] Confirm admin console shows the live payment state safely.
- [ ] Confirm monitoring remains healthy after webhook processing.

## Track 5 - Portal and Reconciliation Proof

Goal: prove operator/customer recovery paths work in live mode.

Checklist:

- [ ] Create billing portal session for the same app/user.
- [ ] Confirm portal belongs to the correct Stripe account/company.
- [ ] Run live reconciliation only if needed or approved in the test window.
- [ ] Record reconciliation run ID if used.
- [ ] Confirm reconciliation does not cross provider account or environment boundaries.

## Track 6 - Refund Pilot, If Approved

Goal: prove refund behavior only if explicitly included in the approval packet.

Checklist:

- [ ] Confirm refund was approved before running it.
- [ ] Perform approved full or partial refund in Stripe.
- [ ] Record refund ID and amount safely.
- [ ] Confirm refund webhook is received and processed.
- [ ] Confirm entitlement/business-state outcome follows approved policy.
- [ ] Confirm support note is ready if customer-facing state changes.

## Track 7 - Evidence, Freeze, and Go/No-Go

Goal: finish the pilot with auditable evidence and a decision.

Checklist:

- [ ] Complete evidence checklist from the controlled live gate runbook.
- [ ] Capture final admin summary without secrets.
- [ ] Capture final monitoring summary without secrets.
- [ ] Record known issues and mitigations.
- [ ] Decide go/no-go for broader live availability.
- [ ] Create Phase 6 freeze note.
- [ ] Confirm Phase 7 may start only if Phase 6 pilot is accepted.

## Stop Conditions

Stop immediately if:

- checkout amount, currency, plan, app, user, or provider account differs from approval;
- any secret appears in a response, screenshot, log, or document;
- webhook signature verification fails or is bypassed;
- entitlement changes from redirect alone;
- monitoring/admin cannot show payment state safely;
- refund behavior is unclear;
- an unapproved second live transaction would be needed.

## Explicitly Not Authorized Until Phase 6 Approval

- No live checkout.
- No real payment.
- No refund.
- No customer rollout.
- No repeated live testing.

## Definition of Done

Phase 6 is complete only when:

- [ ] one approved live checkout is completed or the pilot is explicitly aborted;
- [ ] live webhook and entitlement behavior are verified;
- [ ] portal and reconciliation behavior are verified or intentionally deferred;
- [ ] refund behavior is verified if approved;
- [ ] evidence is recorded safely;
- [ ] Phase 6 freeze note is created;
- [ ] operator makes a go/no-go decision for Phase 7.