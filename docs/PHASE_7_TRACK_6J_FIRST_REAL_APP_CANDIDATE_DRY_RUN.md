# Phase 7 Track 6J - First Real-App Candidate Intake and Dry-Run Proposal

Status: complete.

Purpose: run the first real-app onboarding through the UI-driven process: candidate gate -> `/admin` onboarding artifact export -> non-mutating registry proposal dry-run -> review. This track must not silently invent a candidate app or mutate PayGate registry without operator confirmation.

## Current decision

Track 6J completed after the operator selected MyExpensio and approved a sandbox-only onboarding artifact. A non-mutating dry-run proposal was generated for review.

This is intentional. The PayGate onboarding workflow is now controlled enough that choosing the wrong candidate, owner, provider account, auth boundary, or payment slice would create architectural drift.

## What is ready

- `/admin` is the operator intake surface.
- Exported onboarding artifacts are non-mutating.
- `npm run proposal:dry-run` is available for non-mutating registry proposal review.
- Approved apply is protected by exact phrase: `APPLY REGISTRY PROPOSAL <app_id>`.
- Post-apply checks are mandatory: `npm run validate:registry` and `npm run check`.
- Stripe mutation, Vercel env mutation, deployment, live payments, refunds, and entitlement grants remain separate gates.

## Candidate gate worksheet

Fill this before starting the real-app dry-run:

```text
Candidate app name:
Candidate app_id:
Owning company / billing entity:
Provider account alias:
Test URL:
Live URL, if known:
Auth provider:
User ref source:
First safe payment slice:
Plan-based, item/SKU-based, or both:
Plans/items included in the first slice:
Plans/items explicitly deferred:
Currency:
Amount model:
Support/refund owner:
Operator approval to create onboarding artifact:
```

## Candidate acceptance rules

The candidate can proceed only when all are true:

- [ ] The app is a real app, not a throwaway rehearsal.
- [ ] The operator explicitly confirms this is the one candidate for Track 6J.
- [ ] `app_id` is stable, lowercase snake case, and not already used by another registry package.
- [ ] Provider account alias is known and company-scoped.
- [ ] Test URL is known.
- [ ] Live URL is known or explicitly deferred.
- [ ] Auth provider and `user_ref` source are known.
- [ ] First safe payment slice is sandbox/test only.
- [ ] Dynamic/live/refund/broad-rollout scope is explicitly deferred.
- [ ] No provider secret, webhook secret, Stripe Price ID, or live payment credential is included in the artifact.

## Review folder convention

After the candidate is selected, create:

```text
C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\
```

Save these files there:

```text
candidate-gate.md
onboarding-artifact.json
proposal-dry-run.json
proposal-summary.md
operator-notes.md
```

## Dry-run command

After exporting the onboarding artifact from `/admin`:

```powershell
npm run proposal:dry-run -- "C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\onboarding-artifact.json" --out-dir "C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>"
```

Expected result:

- Reviewable registry proposal files are generated in the review folder.
- `registry/apps/<app_id>/` is not mutated.
- Secret-looking values are rejected.
- The output tells the operator which validation commands must run if apply is later approved.

## Stop condition

Track 6J must stop after dry-run review unless the operator explicitly authorizes registry apply using the exact phrase:

```text
APPLY REGISTRY PROPOSAL <app_id>
```

Registry apply, Stripe setup, Vercel env setup, deployment, sandbox checkout proof, live checkout, and refunds are all separate actions.

## MyExpensio candidate selected

```text
Candidate app name: MyExpensio
Candidate app_id: myexpensio
Owning company / billing entity: NHL Global Solution
Provider account alias: nhl_global_solution
Test URL: https://myexpensio-jade.vercel.app
Live URL: https://myexpensio-jade.vercel.app
Auth provider: Supabase JWT
User ref source: Supabase Auth user id / JWT subject
First safe payment slice: Individual USER Pro monthly subscription checkout, sandbox/test only
Plan-based, item/SKU-based, or both: Plan-based
Plans/items included in the first slice: pro_monthly - MYR 18/month
Plans/items explicitly deferred: premium_monthly, ORG/workspace subscriptions, billing portal migration, live payment, refund automation
Currency: MYR
Amount model: Fixed MYR 18/month subscription
Support/refund owner: NHL Global Solution operator
Operator approval: Approved for MyExpensio sandbox-only onboarding artifact. No live payment, no refund, no provider mutation.
```

## Dry-run evidence

Review folder:

```text
C:\Users\user\Documents\PayGate Proposal Reviews\myexpensio\2026-09-24\
```

Generated review files:

- `candidate-gate.md`
- `onboarding-artifact.json`
- `proposal-summary.md`
- `registry/apps/myexpensio/app.yaml`
- `registry/apps/myexpensio/plans.yaml`
- `registry/apps/myexpensio/entitlements.yaml`
- `registry/apps/myexpensio/integration.yaml`
- `registry/apps/myexpensio/files.manifest.yaml`
- `registry/apps/myexpensio/env.example`
- `registry/apps/myexpensio/integration-status.md`

Dry-run result:

```text
status: dry_run_only
appId: myexpensio
targetDirectory: registry/apps/myexpensio
approvalPhraseRequiredForApply: APPLY REGISTRY PROPOSAL myexpensio
```

PayGate registry was not mutated. `registry/apps/myexpensio` does not exist in the working tree after Track 6J.

## Pricing alignment update

Track 6K resolved the pricing mismatch. MyExpensio pricing is now aligned as Pro = MYR 18/month and Premium = MYR 29/month. The first PayGate dry-run slice is `pro_monthly` at MYR 18/month.

## Track 6J checklist

- [x] Select one real app candidate.
- [x] Complete candidate gate fields.
- [x] Create operator-approved onboarding artifact for the selected candidate.
- [x] Store artifact in the candidate review folder.
- [x] Run non-mutating proposal dry-run with output pointing to the review folder.
- [x] Review generated package output.
- [x] Stop before approved apply unless operator explicitly authorizes the exact apply phrase.

## Next documented step

Track 6K has resolved the pricing alignment. Proceed next to Phase 7 Track 6L - MyExpensio Registry Apply Approval and Validation.