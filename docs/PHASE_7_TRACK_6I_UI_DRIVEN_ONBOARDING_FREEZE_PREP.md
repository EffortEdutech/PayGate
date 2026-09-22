# Phase 7 Track 6I - UI-Driven Onboarding Freeze Prep and First Real-App Candidate Gate

Status: complete.

Purpose: decide whether the UI-driven onboarding workflow is ready to freeze for operator use, and define the gate for choosing the next real app candidate without accidentally starting live payments, provider mutation, Vercel secret changes, refunds, or entitlement grants.

## Decision

The UI-driven onboarding workflow is ready to be used as the controlled intake path for the next real app candidate, with one important boundary:

- the `/admin` onboarding workspace is the operator intake and export surface;
- `npm run proposal:dry-run` is the engineering review/proposal surface;
- approved apply remains CLI-controlled with an exact approval phrase;
- Stripe, Vercel, deployment, live payment, refund, and entitlement mutation remain separate gates.

This is a freeze-prep decision, not a full Phase 7 freeze. The workflow can be used for a sandbox-only candidate onboarding, but broad self-service onboarding is not yet approved.

## Freeze-prep review against Track 6H

Track 6H defined the operator runbook. Track 6I checks it against the current product state.

| Area | Track 6I result | Notes |
| --- | --- | --- |
| Operator starts from `/admin` | Accepted | The admin console has an onboarding workspace and export-oriented flow. |
| Browser mutation boundary | Accepted | Export is non-mutating; registry writes remain CLI-controlled. |
| Proposal review folder | Accepted | Use `C:\Users\user\Documents\PayGate Proposal Reviews\<app_id>\<YYYY-MM-DD>\`. |
| Dry-run proposal generation | Accepted | `npm run proposal:dry-run` exists and is covered by tests. |
| Apply approval phrase | Accepted | Apply requires `APPLY REGISTRY PROPOSAL <app_id>`. |
| Post-apply validation | Accepted | `npm run validate:registry` and `npm run check` are mandatory. |
| Existing app overwrite | Not frozen for self-service | Updating existing app packages still needs a future explicit update-mode design. |
| Stripe/Vercel mutation | Blocked by design | Must remain outside the proposal apply workflow. |
| Live payment/refund | Blocked by design | Requires separate live-mode approval. |

## First real-app candidate gate

Before naming the next real app candidate, the operator must confirm these facts:

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
Plans/items included in the first slice:
Plans/items explicitly deferred:
Expected currency and amount model:
Support/refund owner:
Operator approval to create onboarding artifact:
```

Candidate acceptance rules:

- [x] Candidate must use PayGate, not direct Stripe integration.
- [x] Candidate must have a stable `app_id` before registry proposal.
- [x] Candidate must have a known owner/company/provider account alias.
- [x] Candidate must have at least one safe sandbox/test payment slice.
- [x] Candidate must identify whether it is plan-based, item/SKU-based, or both.
- [x] Candidate must have a clear auth model before checkout proof.
- [x] Candidate must not require live checkout in the first onboarding pass.
- [x] Candidate must not require refund automation in the first onboarding pass.

## Operator workflow for candidate selection

1. Choose one candidate app only.
2. Fill the candidate gate fields above.
3. Open PayGate `/admin`.
4. Use the onboarding workspace to prepare the candidate artifact.
5. Export the artifact.
6. Save the artifact under the candidate review folder.
7. Run proposal dry-run only.
8. Review the generated package files.
9. Stop for explicit approval before any apply.

No app is considered selected until the candidate gate is filled and reviewed.

## Controlled apply gate for the selected candidate

The selected app may move from proposal to registry only when all are true:

- [x] The exported artifact is fresh from the current `/admin` onboarding workspace.
- [x] The dry-run proposal has been generated to the review folder.
- [x] Reviewer confirms no provider secrets or webhook secrets are present.
- [x] Reviewer confirms provider lookup keys are used instead of Stripe Price IDs.
- [x] Reviewer confirms sandbox and live boundaries are not mixed.
- [x] Operator explicitly authorizes registry apply using the exact phrase.

Apply phrase format:

```text
APPLY REGISTRY PROPOSAL <app_id>
```

The apply step is still not allowed to create Stripe catalog objects, mutate Vercel env vars, deploy, run live payments, perform refunds, or grant entitlements.

## Handoff to Phase 7 Track 6J

Track 6J should be the first real-app candidate intake run.

Recommended Track 6J title:

```text
Phase 7 Track 6J - First Real-App Candidate Intake and Dry-Run Proposal
```

Track 6J should do only this:

- select one real app candidate;
- complete the candidate gate fields;
- export the onboarding artifact from `/admin`;
- run the dry-run proposal into the review folder;
- review output;
- stop before approved apply unless the operator explicitly authorizes the apply phrase.

## Track 6I acceptance checklist

- [x] Track 6H runbook reviewed against current `/admin` onboarding workflow.
- [x] UI-driven onboarding is accepted as the primary intake path for the next candidate.
- [x] Browser/export remains non-mutating.
- [x] Proposal dry-run remains the review surface.
- [x] Approved apply remains CLI-controlled by exact phrase.
- [x] First real-app candidate gate fields are documented.
- [x] Stripe mutation, Vercel env mutation, live payment, refund, deployment, and entitlement grants remain separate approval gates.
- [x] Next documented step is defined as Track 6J.