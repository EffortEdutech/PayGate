# Phase 7 Track 6H - Real App Onboarding Operator Runbook and UI Handoff

Status: complete.

Purpose: turn the proven UI export -> proposal dry-run -> approved registry apply rehearsal into the real operator workflow for onboarding the next application without drifting into live payments, secrets, provider mutation, or browser-granted entitlements.

## Scope

Track 6H is a runbook and handoff track. It does not onboard a new real app by itself.

Allowed in this track:

- Document the operator workflow from `/admin` onboarding workspace to registry proposal.
- Define review artifact storage and approval checkpoints.
- Define the safe apply, validation, commit, deploy, and sandbox proof sequence.
- Clarify UI responsibilities versus engineering responsibilities.
- Update sprint checklist and roadmap graph.

Not allowed in this track:

- Creating Stripe products, prices, or webhooks.
- Changing Vercel environment variables.
- Enabling live payments, refunds, or live reconciliation.
- Granting entitlements from browser redirects.
- Applying a real app registry package without explicit operator approval.

## Operator workflow

### 1. Start from PayGate admin

1. Open `https://pay-gate-beta.vercel.app/admin`.
2. Sign in with the PayGate operator credential.
3. Open the onboarding workspace.
4. Create or edit the proposed app intake.
5. Fill only business-safe configuration:
   - app name;
   - `app_id`;
   - provider alias, for example `nhl_global_solution`;
   - test and live origins;
   - return contexts;
   - auth model;
   - plans;
   - optional item/SKU rows if the app needs item-scoped purchases.
6. Do not paste provider secrets, webhook secrets, Stripe price IDs, or live card/payment details into the UI.
7. Export the onboarding artifact.

The export remains a proposal. It is not a registry mutation and it does not activate checkout by itself.

### 2. Store review artifacts

For each real app, create a review folder outside the registry package:

```text
C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\
```

Recommended files in that folder:

```text
onboarding-artifact.json
proposal-dry-run.json
proposal-summary.md
operator-notes.md
screenshots-or-links.txt
```

This folder is for review evidence. It is not the source of truth after approval; the source of truth becomes `registry/apps/<app_id>/` after approved apply and validation.

### 3. Run dry-run proposal

From the PayGate repo:

```powershell
npm run proposal:dry-run -- "C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\onboarding-artifact.json" --out-dir "C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>"
```

Dry-run rules:

- It must not write inside `registry/apps/`.
- It must reject secret-looking values such as `sk_test_`, `sk_live_`, `whsec_`, `rk_test_`, or `rk_live_`.
- It must produce reviewable registry proposal output.
- It must list the post-apply commands that will be mandatory after approval.

### 4. Review before apply

The operator and reviewer must confirm:

- `app_id` is stable, lowercase snake case, and belongs to the intended app.
- Provider account alias is company-scoped and correct.
- Test and live origins are allowlisted and not caller-controlled.
- Return contexts are named contexts, not arbitrary URLs.
- Plans use integer minor units and uppercase ISO currency.
- Registry uses provider lookup keys, not Stripe Price IDs.
- Entitlements are stable PayGate entitlement keys.
- Item/SKU entries, if any, include stable `item_ref` and scoped entitlement behavior.
- No secret or provider credential appears in any generated file.
- Sandbox and live settings are not mixed.

Hard stop if any item is unclear.

### 5. Approved apply

Approved apply requires the exact phrase:

```text
APPLY REGISTRY PROPOSAL <app_id>
```

Command:

```powershell
npm run proposal:dry-run -- "C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\onboarding-artifact.json" --apply --approval "APPLY REGISTRY PROPOSAL <app_id>" --root "C:\Users\user\Documents\00 Payment Gateway"
```

Apply rules:

- Do not apply if `registry/apps/<app_id>/` already exists unless an explicit update mode is later designed and approved.
- Do not apply from an artifact that was manually edited to include secrets.
- Do not apply if the operator has not confirmed the provider account owner.
- Do not apply if live payment, refund, or broad rollout is being silently bundled into the registry change.

### 6. Mandatory post-apply validation

After approved apply:

```powershell
npm run validate:registry
npm run check
```

Both must pass before commit or deploy.

Also inspect:

```powershell
git diff -- registry/apps/<app_id>
git diff --check
```

### 7. Commit, push, deploy

Only after validation passes:

```powershell
git add registry/apps/<app_id> docs
 git commit -m "feat: onboard <app_id> registry package"
 git push
```

Deploy PayGate only after the commit is pushed and the operator confirms this is still a sandbox/test onboarding action.

### 8. Sandbox proof sequence

A real app is not considered onboarded until sandbox/test proof is complete:

1. PayGate deployment is green.
2. `/health` is healthy.
3. Protected diagnostics are ready.
4. `/admin/summary` lists the new app and plans.
5. Stripe sandbox product/price lookup keys exist in the correct provider account.
6. Stripe sandbox webhook endpoint is configured to the correct PayGate endpoint.
7. The app thin client calls PayGate, not Stripe.
8. Checkout completes in Stripe sandbox.
9. Signed webhook is processed by PayGate.
10. App reads PayGate entitlement state.
11. Portal and/or reconciliation proof is completed if relevant to the plan type.
12. Operator evidence packet is saved.

## UI handoff

The admin UI owns intake clarity. The CLI owns controlled file mutation.

Current division of responsibility:

| Area | Owner | Notes |
| --- | --- | --- |
| App intake | `/admin` onboarding workspace | Human-friendly app setup form. |
| Artifact export | `/admin` onboarding workspace | Non-mutating proposal artifact. |
| Registry proposal dry-run | `npm run proposal:dry-run` | Reviewable generated package files. |
| Apply approval | CLI exact approval phrase | Prevents accidental registry writes. |
| Registry validation | `npm run validate:registry` | Required by PayGate constitution. |
| Full product check | `npm run check` | Required before commit/deploy. |
| Stripe/Vercel mutation | Separate operator gate | Never bundled into registry apply. |
| Live payment/refund | Separate live gate | Not part of onboarding apply. |

## Evidence packet checklist

For every real app onboarding, capture:

- exported onboarding artifact path;
- dry-run proposal output folder;
- exact approval phrase used, if apply occurs;
- registry validation output;
- full check output;
- commit hash;
- PayGate deployment URL;
- app deployment URL;
- Stripe sandbox product/price lookup key evidence;
- webhook event ID;
- checkout session ID;
- customer/user ref;
- entitlement state screenshot or JSON;
- monitoring/admin summary after proof;
- deferred items and live-mode hold note.

## Track 6H acceptance checklist

- [x] Operator steps from `/admin` export to proposal dry-run are documented.
- [x] Proposal review artifact storage is documented.
- [x] Approved apply rules and exact approval phrase are documented.
- [x] Post-apply validation, commit, deploy, and sandbox proof sequence is documented.
- [x] Live payments, refunds, Stripe mutation, Vercel env mutation, and entitlement grants remain separate approval gates.
- [x] Multi-app onboarding runbook is updated to make UI-driven onboarding the primary path.
- [x] Product checklist and roadmap graph are updated.

## Next documented step

Proceed to Phase 7 Track 6I - UI-driven onboarding freeze prep and first real-app candidate gate.

Track 6I should decide whether the onboarding workspace is ready to freeze for operator use, then select the next real app candidate for a controlled sandbox-only onboarding run.