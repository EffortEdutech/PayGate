# Phase 7 Track 2 - App #2 Intake and Classification

Date: 2026-09-10
Status: sample intake rehearsal complete; real app #2 pending operator selection.

## Purpose

Track 2 decides whether a candidate app is ready to enter PayGate onboarding. This track does not create registry files, configure Stripe, deploy code, or mutate live state. It classifies the candidate and records what is known, missing, and blocked before Track 3 registry package creation.

## Intake Artifact Reviewed

Exported draft file reviewed:

`C:\Users\user\Documents\00 Payment Gateway\tests\example_app-paygate-registry-draft.json`

The JSON is syntactically clean and contains plain URL strings. The earlier Markdown link appearance was chat rendering only.

## Candidate Classification

Candidate app ID: `example_app`

Classification: `sample_rehearsal_only`

Reason: the draft uses placeholder values (`example_app`, `Example App`, `https://example-app-test.vercel.app/`, `https://example-app.com/`). It proves the Track 1K wizard/export path works, but it is not yet a real app #2 onboarding package.

## Known From Draft

| Field | Value | Classification |
| --- | --- | --- |
| App ID | `example_app` | placeholder |
| App name | `Example App` | placeholder |
| Provider | `stripe` | acceptable |
| Provider account alias | `nhl_global_solution` | known PayGate alias |
| Auth model | `supabase_jwt` | acceptable pattern, must be confirmed for real app |
| Test origin | `https://example-app-test.vercel.app/` | placeholder |
| Live origin | `https://example-app.com/` | placeholder |
| Return context | `billing` | acceptable |
| Plan key | `starter_monthly` | placeholder |
| Plan mode | `payment` | acceptable if real app sells one-time access |
| Amount | `3900` minor units | placeholder, MYR 39.00 equivalent |
| Currency | `MYR` | acceptable |
| Provider lookup key | `example_app_starter_monthly` | placeholder, not a Stripe price ID |
| Entitlement | `example_app.feature` | placeholder |

## Track 2 Checklist

- [x] Review exported draft artifact.
- [x] Confirm artifact is draft-only and does not contain secrets.
- [x] Confirm the wizard/export path can produce a usable intake artifact.
- [x] Classify `example_app` as a sample rehearsal, not a real app #2.
- [ ] Identify real app #2 name and repository/location.
- [ ] Confirm real app owner/operator.
- [ ] Confirm real app production and sandbox URLs.
- [ ] Confirm real app user identity provider and JWT/session strategy.
- [ ] Confirm real app product model: one-time pass, subscription, usage credits, or mixed products.
- [ ] Confirm company/provider account owner.
- [ ] Confirm support/refund owner.
- [ ] Confirm whether real app #2 can use existing PayGate contracts unchanged.

## Required Real App #2 Inputs

Before Track 3 can start, the operator must provide or confirm:

1. App display name.
2. App repository or deployment location.
3. App ID to use in PayGate, lowercase snake case.
4. Test/staging origin URL.
5. Live production origin URL.
6. Auth model and issuer/JWKS details if not using the same Supabase JWT pattern.
7. Provider account alias/company owner.
8. Plan list with prices in minor units and currencies.
9. Stripe lookup keys to create/use.
10. Entitlement keys that the app will consume.
11. Support/refund owner.
12. Sandbox proof owner.

## Decision

Track 2 sample rehearsal is accepted. Real app #2 onboarding is not yet approved because the candidate is still a placeholder.

Next documented gate:

- Operator chooses the real app #2 and provides the required intake details.
- Then proceed to Track 3 - Registry Package Creation.

## Safety Boundary

No registry package was created. No Stripe Product/Price was created. No environment variables were changed. No live checkout, webhook, portal, reconciliation, refund, or entitlement mutation was performed.