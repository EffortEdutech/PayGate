# Controlled Live Stripe Payment and Refund Gate

Status: documentation prepared; live execution is not authorized yet.

This runbook defines the one-time controlled live Stripe payment and refund test that will be used when the operator explicitly approves live-mode testing. It does not authorize live credentials, live checkout creation, live webhook processing, or live refunds by itself.

Use `docs/PHASE_6_LIVE_PILOT_APPROVAL_TEMPLATE.md` for the approval record and `docs/PHASE_6_LIVE_PILOT_EVIDENCE_LOG_TEMPLATE.md` for evidence capture. Completed approval and evidence records must remain outside source control.

## Purpose

The first live test proves that PayGate can safely process real money for one app, one company-owned Stripe account, one small approved amount, and one known operator-controlled user before broader production use.

## Non-Negotiable Boundaries

- Apps still submit only `app_id`, `user_ref`, `plan_key`, `return_context`, and `environment`.
- Apps must not submit amount, currency, Stripe Price ID, Stripe customer ID, provider account, provider subscription ID, entitlement keys, or arbitrary return URLs.
- PayGate registry remains the authority for app/provider account/plan/price lookup/return URL mapping.
- Live and test mode stay isolated in credentials, webhook endpoints, provider mappings, data, and idempotency scope.
- Browser redirects never grant access. Only verified live webhook events or explicit live reconciliation evidence may mutate entitlements.
- Provider secrets remain server-side only and must not appear in repository files, browser code, API responses, screenshots, or logs.

## Required Approval Record

Record this approval outside source control before running the test:

```text
Approved by:
Approval timestamp:
PayGate deployment URL:
App:
App production URL:
Company / Stripe account owner:
Provider account alias:
Stripe account ID:
Environment: live
Plan key:
Expected live amount and currency:
Expected user_ref:
Expected customer email:
Refund test approved: yes/no
Refund type: full / partial / none
Refund amount if partial:
Support / rollback owner:
Evidence storage location:
```

## Pre-Live Checklist

All items must be true before the live test starts:

- [ ] Operator diagnostics are protected.
- [ ] Admin console is protected and does not expose secrets.
- [ ] Monitoring summary is available and reviewed.
- [ ] Provider account isolation tests pass.
- [ ] Stripe live account owner/legal entity is confirmed.
- [ ] Live Stripe account has statement descriptor, support email, receipt, invoice, tax, and branding reviewed.
- [ ] Live Product and Price are created intentionally in the correct Stripe account.
- [ ] PayGate live registry/config maps the app to the correct provider account alias.
- [ ] Live Price lookup key matches the PayGate registry plan mapping.
- [ ] Live webhook endpoint is configured in Stripe for the correct PayGate URL, provider account alias, and `/live` environment.
- [ ] Live webhook signing secret is stored only in Vercel/server-side secret storage.
- [ ] Live secret key is stored only in Vercel/server-side secret storage.
- [ ] No browser-visible static PayGate token is configured.
- [ ] Supabase/database backup or restore plan is confirmed.
- [ ] Small controlled amount is approved.
- [ ] Refund behavior is approved before any refund is performed.

## Controlled Live Test Sequence

1. Confirm PayGate `/health` is public and healthy.
2. Confirm protected diagnostics and admin console are accessible only with operator authorization.
3. Confirm admin summary shows the intended app/provider account mapping.
4. From the production app, create one live checkout session for the approved user and plan.
5. Confirm the checkout amount, currency, company, and product name before paying.
6. Complete the payment using the approved real payment method.
7. Verify PayGate receives and processes the signed live webhook.
8. Verify app subscription/entitlement state changes only after verified webhook processing.
9. Open the billing portal for the same app/user and confirm it belongs to the correct Stripe account.
10. If approved, perform the planned full or partial refund in Stripe.
11. Verify refund webhook delivery and PayGate handling.
12. Verify the business decision after refund: entitlement remains active, is revoked, or is manually reviewed according to the approved policy.
13. Run live reconciliation for the same app/user if needed.
14. Record evidence and final operator result.

## Evidence Checklist

Capture safe evidence only. Do not capture or paste secret keys, webhook secrets, card data, or full personal data.

- [ ] PayGate deployment URL and commit SHA.
- [ ] App URL and user_ref.
- [ ] Provider account alias and Stripe account ID.
- [ ] Plan key, amount, currency, and checkout mode.
- [ ] Checkout session ID.
- [ ] Stripe payment intent or charge ID.
- [ ] Webhook event IDs and processed status.
- [ ] Entitlement state after payment.
- [ ] Portal session proof.
- [ ] Refund ID and refund amount, if applicable.
- [ ] Entitlement/business state after refund.
- [ ] Reconciliation run ID, if reconciliation is used.
- [ ] Monitoring summary after the live test.

## Stop Conditions

Stop immediately and do not continue the test if any of these occur:

- The app can influence amount, currency, provider account, provider price ID, customer ID, or entitlement keys.
- The live Stripe account is not the approved company account.
- Checkout amount, currency, plan, company, or user differs from the approval record.
- PayGate accepts an unsigned or unverifiable webhook.
- Entitlement changes happen from browser redirect alone.
- Admin/diagnostics responses expose secrets.
- Webhook or reconciliation failures are not visible to the operator.
- Refund behavior is unclear or not approved.
- Any live amount exceeds the approved amount.

## Current Decision

Live payment and refund execution is deferred. The next allowed action is to complete any remaining live readiness checklist items and then request explicit operator approval for a controlled live test window.