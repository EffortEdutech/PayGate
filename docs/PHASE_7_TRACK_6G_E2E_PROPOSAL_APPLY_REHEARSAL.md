# Phase 7 Track 6G - End-to-End Proposal Apply Rehearsal

Status: implemented and verified with an isolated throwaway app rehearsal.

## Objective

Rehearse the complete safe registry proposal flow before using it for a real app:

1. create a throwaway onboarding artifact;
2. generate the registry proposal;
3. require the exact operator approval phrase;
4. apply into an isolated registry root;
5. validate the isolated registry package;
6. confirm no Stripe, Vercel, live, refund, deployment, or entitlement mutation occurs.

## Rehearsal result

The automated rehearsal uses a throwaway app ID:

```text
throwaway_app
```

The test creates a temporary root outside the real PayGate registry, copies registry schemas, applies the proposal with:

```text
APPLY REGISTRY PROPOSAL throwaway_app
```

Then it runs registry validation against that isolated root.

Result:

- isolated app package written only under temp root;
- real `registry/apps` remains unchanged;
- generated 7 proposal files;
- isolated registry validation returns `appCount: 1`;
- isolated registry validation returns no errors.

## Files covered by rehearsal

The throwaway apply generates:

- `registry/apps/throwaway_app/app.yaml`
- `registry/apps/throwaway_app/plans.yaml`
- `registry/apps/throwaway_app/entitlements.yaml`
- `registry/apps/throwaway_app/integration.yaml`
- `registry/apps/throwaway_app/files.manifest.yaml`
- `registry/apps/throwaway_app/env.example`
- `registry/apps/throwaway_app/integration-status.md`

No `items.yaml` is generated for this rehearsal because the throwaway app uses a simple one-time plan only.

## Safety boundaries confirmed

- Real registry was not mutated.
- Apply required exact approval phrase.
- Apply target was isolated temp root.
- Registry schema validation passed in the isolated root.
- No Stripe calls were made.
- No Vercel environment variables were changed.
- No live mode was enabled.
- No refund action was performed.
- No deployment was performed.
- No entitlement grant was performed.

## Verification command

The rehearsal is covered by:

```powershell
node --import tsx --test tests/unit/onboarding-registry-proposal.test.ts
```

It is also included in:

```powershell
npm run check
```

## Files changed

- `tests/unit/onboarding-registry-proposal.test.ts`
  - Added isolated throwaway app rehearsal.
  - Verifies approved apply into temp root.
  - Verifies registry validation succeeds against the isolated root.

- `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`
  - Marks Track 6G complete and adds Track 6H as the next gate.

- `docs/PRODUCT_COMPLETION_CHECKLIST.md`
  - Marks Track 6G complete.

- `docs/PRODUCT_ROADMAP_GRAPH.md`
  - Updates the graph to show Track 6G complete and Track 6H next.

## Acceptance checklist

- [x] Create or generate a throwaway onboarding artifact.
- [x] Run proposal dry-run and review proposed files.
- [x] Apply with the exact approval phrase into an isolated root.
- [x] Run registry validation/checks against the isolated proposal.
- [x] Confirm no Stripe, Vercel, live-mode, refund, deployment, or entitlement mutation occurs.

## Next recommended track

Proceed to Phase 7 Track 6H - Real App Onboarding Operator Runbook and UI Handoff.

Track 6H should turn the proven dry-run/apply rehearsal into the operator-facing process for onboarding the next real app without drifting into live payments or uncontrolled mutation.
