# Live-Mode Readiness Checklist

**Status:** prepared - live payments are still blocked until explicit operator approval.  
**Applies to:** PayGate, AIntern, and every future app onboarded through the Central Payment Hub.

## Purpose

This checklist prepares PayGate for eventual live Stripe payment and refund testing without accidentally enabling live money movement.

Completing this document does not authorize live payments. A live test requires a separate operator approval window after monitoring and provider-account isolation gates are complete.

## Current Safety Position

- PayGate has proven deployed sandbox checkout, webhook, entitlement, portal, reconciliation, and admin inspection paths.
- The current Stripe adapter is still sandbox-first and rejects live secret keys.
- Live provider credentials must not be added casually to the existing sandbox deployment.
- Browser applications must not receive static PayGate tokens or provider credentials.

## Gate 1 - Environment Separation

Required before live testing:

- [ ] Keep sandbox/test and live provider configuration separate.
- [ ] Use separate Stripe webhook endpoints for test and live mode.
- [ ] Use separate Stripe Product/Price IDs for test and live mode.
- [ ] Use separate Stripe webhook signing secrets for test and live mode.
- [ ] Keep test and live idempotency scope separated by `environment`.
- [ ] Keep test and live provider account mappings auditable in registry/config.
- [ ] Confirm live secrets are stored only in Vercel/project secret storage.
- [ ] Confirm live secrets are never committed to the repository.

Recommended live env naming pattern, to be implemented only during live activation work:

```ini
STRIPE_LIVE_ACCOUNTS=<provider_alias>
STRIPE_LIVE_ACCOUNT_<ALIAS>_SECRET_KEY=sk_live_...
STRIPE_LIVE_ACCOUNT_<ALIAS>_WEBHOOK_SECRET=whsec_...
```

Do not reuse sandbox variable names for live credentials.

## Gate 2 - Production Domain and Return URLs

Required before live testing:

- [ ] Confirm PayGate production domain, for example `https://payments.effortedutech.com`.
- [ ] Confirm AIntern production domain, for example `https://aintern.effortedutech.com`.
- [ ] Confirm registry `application_urls.live` values are final.
- [ ] Confirm all live return contexts are allowlisted in registry.
- [ ] Confirm browser redirects remain UX hints only and do not grant entitlements.
- [ ] Confirm CORS allows only approved production app origins.

## Gate 3 - Stripe Live Account Settings

For each live Stripe company account:

- [ ] Confirm legal/business owner.
- [ ] Confirm bank payout setup.
- [ ] Confirm business profile.
- [ ] Confirm customer support email.
- [ ] Confirm customer support phone or support URL if required.
- [ ] Confirm statement descriptor.
- [ ] Confirm receipt settings.
- [ ] Confirm invoice settings.
- [ ] Confirm tax settings, where applicable.
- [ ] Confirm refund policy.
- [ ] Confirm dispute handling owner.
- [ ] Confirm portal branding and return URL.

## Gate 4 - Live Product and Price Setup

For each live plan:

- [ ] Create live Product intentionally in the correct Stripe account.
- [ ] Create live Price intentionally in the correct Stripe account.
- [ ] Confirm amount uses integer minor units in PayGate registry.
- [ ] Confirm Stripe amount/currency matches registry exactly.
- [ ] Confirm one-time vs recurring mode matches registry exactly.
- [ ] Confirm live lookup key strategy before coding live support.
- [ ] Do not copy sandbox IDs blindly into live configuration.
- [ ] Do not expose live Price IDs to application code.

## Gate 5 - Database and Operations

Required before live testing:

- [ ] Confirm Supabase database backups are enabled or an equivalent backup plan exists.
- [ ] Confirm restore procedure is documented.
- [ ] Confirm operator admin access is protected by `OPERATOR_DIAGNOSTICS_TOKEN` or stronger auth.
- [ ] Confirm `/health` remains public minimal liveness only.
- [ ] Confirm `/diagnostics/*` and `/admin/summary` remain protected.
- [ ] Confirm no browser-visible PayGate static token is configured.
- [ ] Confirm webhook failures and reconciliation failures are visible to the operator.

## Gate 6 - Monitoring and Alerting Dependency

Live testing waits for Phase 4 Track 6 monitoring/alerting baseline:

- [ ] Failed webhook verification attempts visible.
- [ ] Unprocessed or failed webhook inbox events visible.
- [ ] Failed reconciliation runs visible.
- [ ] Database connection failures visible.
- [ ] Stripe API failures visible.
- [ ] Operator alert route/channel chosen.
- [ ] Retry and escalation process documented.

## Gate 7 - Provider Account Isolation Dependency

Live testing waits for Phase 4 Track 7 provider isolation tests:

- [x] At least two named provider accounts represented in test fixtures.
- [x] App cannot use another app/company provider account.
- [x] Webhook endpoint account scope is enforced.
- [x] Portal session account scope is enforced.
- [x] Reconciliation account scope is enforced.
- [x] Unknown provider accounts fail closed.
- [x] Full test suite passes.

## Gate 8 - First Live Payment Approval

The first live payment requires explicit operator approval after Gates 1-7 are complete.

Approval record should include:

```text
Approved by:
Approved date/time:
Company/provider account:
App:
Plan:
Live amount:
Expected customer/user ref:
Refund test: yes/no
Rollback/support owner:
```

## Controlled Live Test Sequence

When approved:

1. Deploy PayGate production configuration.
2. Confirm `/health` and protected diagnostics.
3. Confirm admin console can see live app/provider mapping without exposing secrets.
4. Create one low-value live checkout session from the production app.
5. Complete real payment.
6. Verify live signed webhook ingestion.
7. Verify live entitlement projection.
8. Verify receipt/invoice behavior.
9. Open billing portal.
10. Perform approved partial/full refund if included in the approval window.
11. Verify refund webhook handling.
12. Verify entitlement/business-state decision after refund.
13. Record evidence and freeze live proof notes.

## Stop Conditions

Stop the live test immediately if any of these occur:

- Webhook endpoint receives unsigned or unverifiable live events.
- Entitlement projection changes from browser redirect alone.
- App sees raw provider statuses instead of Hub states.
- Provider account alias does not match the intended company.
- Admin diagnostics expose secrets.
- Refund behavior is unclear or not approved.
- Any live amount is higher than the approved test amount.

## Current Decision

Live Stripe payments and refunds are not authorized yet.

Next dependencies before live testing:

1. Phase 4 Track 6 - Monitoring and Alerting.
2. Phase 4 Track 7 - Provider Account Isolation Tests. Completed in code tests; live account approval still requires operator sign-off.
3. Explicit operator approval for a controlled live payment/refund window.
