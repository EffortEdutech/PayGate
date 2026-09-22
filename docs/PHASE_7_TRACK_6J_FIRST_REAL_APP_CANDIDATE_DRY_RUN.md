# Phase 7 Track 6J - First Real-App Candidate Intake and Dry-Run Proposal

Status: awaiting operator candidate selection.

Purpose: run the first real-app onboarding through the UI-driven process: candidate gate -> `/admin` onboarding artifact export -> non-mutating registry proposal dry-run -> review. This track must not silently invent a candidate app or mutate PayGate registry without operator confirmation.

## Current decision

Track 6J cannot be completed until the operator selects one real app candidate and provides the candidate gate fields.

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

## Track 6J checklist

- [ ] Select one real app candidate.
- [ ] Complete candidate gate fields.
- [ ] Export fresh onboarding artifact from `/admin`.
- [ ] Store artifact in the candidate review folder.
- [ ] Run `npm run proposal:dry-run` with `--out-dir` pointing to the review folder.
- [ ] Review generated package output.
- [ ] Stop before approved apply unless operator explicitly authorizes the exact apply phrase.

## Next action needed from operator

Provide the completed candidate gate worksheet. After that, continue Track 6J by creating the review folder, exporting/saving the artifact, and running the non-mutating proposal dry-run.