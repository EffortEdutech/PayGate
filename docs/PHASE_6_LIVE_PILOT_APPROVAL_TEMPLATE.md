# Phase 6 Live Pilot Approval Template

Status: template only; not completed; not an execution approval.
Created: 2026-09-07.

This template defines the exact approval record required before PayGate may run a controlled live Stripe payment or refund pilot. The completed approval record must be stored outside source control because it may contain operational details that should not be committed.

## How to Use This Template

1. Copy this template to the approved operator evidence location outside the repository.
2. Complete every required field before any live checkout is created.
3. Confirm the live checkout scope matches this approval exactly.
4. Stop immediately if app, provider account, plan, amount, currency, user, or refund scope changes.

## Approval Record

```text
Approved by:
Approval timestamp:
PayGate deployment URL:
PayGate deployment commit SHA:
App ID:
App production URL:
Company / Stripe account owner:
Stripe account ID:
Provider account alias:
Environment: live
Plan key:
Checkout mode: payment / subscription
Expected live amount and currency:
Expected user_ref:
Expected customer email:
Approved payment method owner:
Refund test approved: yes/no
Refund type: full / partial / none
Refund amount if partial:
Support / rollback owner:
Evidence storage location:
Live test time window:
Explicit approval sentence:
```

## Required Explicit Approval Sentence

Use this exact shape in the completed record:

```text
I approve PayGate Phase 6 to run one controlled live Stripe checkout for [APP_ID], provider account [PROVIDER_ACCOUNT_ALIAS], plan [PLAN_KEY], amount [AMOUNT CURRENCY], user [USER_REF], during [TIME_WINDOW]. I understand this uses real money. Refund scope is [NONE/FULL/PARTIAL AMOUNT].
```

## Pre-Approval Checklist

- [ ] PayGate Phase 5 freeze accepted.
- [ ] `npm run check` passed on the deployment commit.
- [ ] Live Stripe account owner/company verified.
- [ ] Live Product and Price verified in the correct Stripe account.
- [ ] Registry live lookup key matches approved plan.
- [ ] Live webhook endpoint created for the exact PayGate URL and provider account alias.
- [ ] Live webhook signing secret stored only in Vercel/server-side environment variables.
- [ ] Live secret key stored only in Vercel/server-side environment variables.
- [ ] Diagnostics/admin routes protected by operator auth.
- [ ] Monitoring reviewed before pilot.
- [ ] No browser-visible PayGate static token configured.
- [ ] Evidence location prepared outside source control.

## Not Allowed Without a New Approval

- A second live checkout.
- A different user.
- A different app.
- A different provider account alias.
- A different Stripe account.
- A different plan, amount, currency, or checkout mode.
- Any refund that differs from the approval record.