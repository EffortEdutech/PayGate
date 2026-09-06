# Phase 6 Live Pilot Evidence Log Template

Status: template only; do not store completed live evidence in source control.
Created: 2026-09-07.

This template defines the safe evidence to capture during the controlled live pilot. Store the completed evidence log outside this repository. Do not paste secret keys, webhook signing secrets, full card details, full personal data, or unrestricted dashboard screenshots.

## Evidence Header

```text
Evidence owner:
Evidence storage location:
Pilot approval record location:
Pilot start timestamp:
Pilot end timestamp:
Final result: passed / failed / aborted
Go-no-go recommendation:
```

## Deployment Evidence

```text
PayGate production URL:
PayGate commit SHA:
App production URL:
App ID:
Provider account alias:
Stripe account ID:
Environment: live
```

## Preflight Evidence

- [ ] `/health` healthy.
- [ ] Diagnostics require operator token.
- [ ] Admin console requires operator token.
- [ ] Monitoring summary reviewed.
- [ ] Live registry mapping reviewed.
- [ ] Live webhook endpoint reviewed.
- [ ] Database backup/restore approach confirmed.

## Checkout Evidence

```text
Approved plan key:
Approved amount and currency:
Observed checkout amount and currency:
Checkout session ID:
Payment intent ID:
Charge ID:
Customer email, masked if needed:
```

Checklist:

- [ ] Checkout company/branding matches approved Stripe account.
- [ ] Amount and currency match approval exactly.
- [ ] Only one live checkout was created under this approval.
- [ ] App did not submit amount, currency, provider price ID, provider account, customer ID, or entitlement keys.

## Webhook and Entitlement Evidence

```text
Webhook event IDs:
Webhook processed timestamp:
PayGate subscription state:
PayGate entitlement state:
```

Checklist:

- [ ] Signed live webhook received.
- [ ] Webhook processed successfully.
- [ ] Entitlement changed only after verified webhook or approved reconciliation evidence.
- [ ] Browser redirect alone did not grant access.

## Portal and Reconciliation Evidence

```text
Portal session created: yes/no
Portal proof notes:
Reconciliation run used: yes/no
Reconciliation run ID:
Reconciliation result:
```

Checklist:

- [ ] Portal belongs to the approved Stripe account/company.
- [ ] Reconciliation did not cross app, provider account, or environment boundaries.

## Refund Evidence, If Approved

```text
Refund approved: yes/no
Refund type: full / partial / none
Refund amount:
Refund ID:
Refund webhook event IDs:
Post-refund subscription state:
Post-refund entitlement state:
```

Checklist:

- [ ] Refund matched approval exactly.
- [ ] Refund webhook processed successfully.
- [ ] Entitlement/business result followed `docs/REFUND_AND_CHARGEBACK_POLICY.md`.

## Monitoring and Issues

```text
Final monitoring status:
Warnings:
Errors:
Known issues:
Mitigations:
Follow-up work:
```

## Freeze Decision

```text
Phase 6 result: accepted / rejected / repeat required / aborted
Phase 7 allowed to begin: yes/no
Decision by:
Decision timestamp:
Decision notes:
```