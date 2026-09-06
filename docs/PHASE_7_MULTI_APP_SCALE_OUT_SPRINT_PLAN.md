# Phase 7 - Multi-App Scale-Out Sprint Plan

Status: planned; not started.
Parent product plan: `docs/PRODUCT_PLAN.md`.
Related runbook: `docs/MULTI_APP_ONBOARDING_RUNBOOK.md`.

## Objective

Scale PayGate from the first proven app, AIntern, to a repeatable multi-app payment platform where each new app can be onboarded through a controlled checklist with correct company/provider account routing, registry-owned commercial authority, app-owned authentication, sandbox proof, monitoring, and production readiness gates.

## Core Guardrail

Phase 7 starts only after the controlled live pilot is accepted or explicitly deferred by the operator. New apps must never copy AIntern-specific assumptions blindly. Every app must declare its own app ID, user identity strategy, provider account owner, return URL allowlist, plan catalog, entitlements, and deployment evidence.

## Track 1 - App #2 Intake and Classification

Goal: decide whether an app is ready to onboard.

Checklist:

- [ ] Identify app #2 name and repository/location.
- [ ] Confirm app owner/operator.
- [ ] Confirm production and sandbox URLs.
- [ ] Confirm user identity provider and JWT/session strategy.
- [ ] Confirm whether the app sells one-time passes, subscriptions, usage credits, or mixed products.
- [ ] Confirm company/provider account owner.
- [ ] Confirm support/refund owner.
- [ ] Confirm whether app #2 can use existing PayGate contracts unchanged.

## Track 2 - Registry Package Creation

Goal: add app #2 to PayGate without giving the app commercial authority.

Checklist:

- [ ] Create registry app package.
- [ ] Define app ID and display name.
- [ ] Define provider ID and provider account alias.
- [ ] Define test and live origin allowlists.
- [ ] Define allowed return contexts.
- [ ] Define plans using integer minor units and uppercase currency.
- [ ] Define provider lookup keys, not provider price IDs.
- [ ] Define entitlements.
- [ ] Run `npm run validate:registry`.

## Track 3 - Provider Account and Stripe Setup

Goal: ensure app #2 bills through the correct company account.

Checklist:

- [ ] Confirm provider account alias is company-scoped.
- [ ] Confirm Stripe test account access.
- [ ] Create Stripe sandbox Products and Prices intentionally.
- [ ] Configure lookup keys matching registry.
- [ ] Configure sandbox webhook endpoint.
- [ ] Store secrets only in Vercel/server-side secret storage.
- [ ] Verify provider account isolation tests still pass.

## Track 4 - App Thin Payment Client

Goal: integrate app #2 as a PayGate consumer only.

Checklist:

- [ ] Add thin payment service/client inside app #2.
- [ ] App sends only app ID, user ref, plan key, return context, and environment.
- [ ] App never stores Stripe secret key or webhook secret.
- [ ] App never sends amount, price ID, customer ID, provider account, or entitlement keys.
- [ ] App handles checkout redirect URL returned by PayGate.
- [ ] App reads subscription/entitlement state from PayGate or its backend projection.
- [ ] App displays provider-neutral states only.

## Track 5 - App Authentication Boundary

Goal: ensure PayGate trusts app #2 requests safely.

Checklist:

- [ ] Define app #2 auth method: Supabase JWKS/JWT, backend proxy, or server token.
- [ ] Ensure browser-visible static PayGate tokens are not used in production.
- [ ] Enforce app ID claim binding.
- [ ] Enforce user_ref binding.
- [ ] Add negative tests for cross-app/cross-user requests.

## Track 6 - Sandbox E2E Proof

Goal: prove app #2 works in sandbox before live readiness.

Checklist:

- [ ] Create sandbox checkout from app #2.
- [ ] Complete sandbox payment.
- [ ] Verify signed webhook is processed.
- [ ] Verify entitlement projection.
- [ ] Verify portal session.
- [ ] Run reconciliation.
- [ ] Confirm monitoring/admin visibility.
- [ ] Record evidence safely.

## Track 7 - Multi-App Operator Console Readiness

Goal: make the operator view useful as apps multiply.

Checklist:

- [ ] Filter admin summary by app.
- [ ] Filter monitoring by app and environment.
- [ ] Confirm app/provider account mapping is visible.
- [ ] Confirm no secrets are shown.
- [ ] Confirm failed webhook/reconciliation alerts identify app/provider account/environment.
- [ ] Document operator triage steps for app #2.

## Track 8 - Scale-Out Freeze and Repeatability

Goal: ensure app #3 can follow the same process.

Checklist:

- [ ] Update multi-app onboarding runbook with lessons learned from app #2.
- [ ] Update product roadmap if scope changes.
- [ ] Confirm all app #2 tests pass.
- [ ] Confirm PayGate tests pass.
- [ ] Create Phase 7 freeze note.
- [ ] Decide next app intake order.

## Stop Conditions

Stop and update the product plan before proceeding if app #2 requires:

- app-owned provider SDK logic;
- app-controlled price/amount/currency/provider account;
- arbitrary return URLs;
- entitlement mutation from redirect;
- sharing one provider account accidentally across companies;
- live payments before sandbox proof;
- changes to frozen Phase 0 contracts.

## Explicitly Not Authorized In Phase 7

- No live payment for a new app before its sandbox proof and operator approval.
- No new payment provider implementation unless separately planned.
- No weakening of AIntern or PayGate boundaries for convenience.
- No secrets committed to either PayGate or app repositories.

## Definition of Done

Phase 7 is complete only when:

- [ ] at least one additional app is onboarded through the runbook;
- [ ] app #2 sandbox proof is complete;
- [ ] provider account isolation still passes;
- [ ] admin/monitoring supports multi-app operation safely;
- [ ] onboarding runbook is updated from real app #2 evidence;
- [ ] Phase 7 freeze note is created.