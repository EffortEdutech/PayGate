# Phase 7 Track 6F - Operator Approval Gate for Registry Proposal Apply

Status: implemented and verified.

## Objective

Add an explicit operator approval boundary before any dry-run registry proposal can write files into a working tree.

Track 6F keeps the apply action limited to registry proposal files only. It does not call Stripe, configure Vercel, deploy, enable live mode, create refunds, or grant entitlements.

## Implemented scope

Track 6F extends `scripts/onboarding-registry-proposal.ts` with a controlled apply mode.

The apply mode requires:

1. A valid Track 6C/6E onboarding proposal with no blocked reasons.
2. Exact operator approval phrase:

```text
APPLY REGISTRY PROPOSAL <app_id>
```

Example:

```text
APPLY REGISTRY PROPOSAL story_app
```

3. A target root directory.
4. Path confinement to:

```text
<root>/registry/apps/<app_id>/
```

5. No overwrite of an existing app package unless future update mode is explicitly approved.

## CLI shape

Dry-run remains the default:

```powershell
npm run proposal:dry-run -- path\to\onboarding-artifact.json
```

Apply mode requires explicit approval:

```powershell
npm run proposal:dry-run -- path\to\onboarding-artifact.json --apply --approval "APPLY REGISTRY PROPOSAL story_app" --root C:\path\to\PayGate
```

If the approval phrase is wrong, no files are written.

## Required follow-up after approved apply

The apply result reports these required commands:

```powershell
npm run validate:registry
npm run check
```

These remain mandatory before commit/deploy.

## Safety boundaries preserved

- Dry-run remains default.
- Apply requires exact approval phrase.
- Apply is path-confined to `registry/apps/<app_id>/`.
- Existing app packages are refused unless explicit future update mode is introduced.
- Secret-looking artifacts remain blocked.
- Stripe lookup keys remain registry-owned; provider price IDs are refused by validation.
- No Stripe Product/Price creation.
- No Vercel environment variable mutation.
- No deployment.
- No live-mode enablement.
- No refund action.
- No entitlement mutation.
- App repository modification remains governed separately by `files.manifest.yaml`.

## Files changed

- `scripts/onboarding-registry-proposal.ts`
  - Added `registryApplyApprovalPhrase`.
  - Added `applyRegistryProposal`.
  - Added `--apply`, `--approval`, `--root`, and `--allow-existing` CLI parsing.
  - Reports required validation commands after successful apply.

- `tests/unit/onboarding-registry-proposal.test.ts`
  - Verifies wrong approval phrase writes nothing.
  - Verifies approved apply writes into a temporary registry root.
  - Verifies existing app package overwrite is refused by default.

- `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`
  - Marks Track 6F complete and adds the next controlled Track 6G.

- `docs/PRODUCT_COMPLETION_CHECKLIST.md`
  - Marks Track 6F complete.

- `docs/PRODUCT_ROADMAP_GRAPH.md`
  - Updates the graph to show Track 6F complete and Track 6G next.

## Acceptance checklist

- [x] Define exact approval phrase or UI control for write mode.
- [x] Require dry-run preview before apply.
- [x] Refuse overwriting existing app packages unless update mode is explicit.
- [x] Run/report `npm run validate:registry` and `npm run check` after approved apply.
- [x] Keep Stripe, Vercel env vars, live mode, refunds, deployments, and entitlements outside automatic apply.

## Next recommended track

Proceed to Phase 7 Track 6G - End-to-End Proposal Apply Rehearsal with a throwaway app.

Track 6G should use a temporary/sample onboarding artifact and isolated output/root to rehearse the dry-run -> approved apply -> validation cycle without onboarding a real production app.
