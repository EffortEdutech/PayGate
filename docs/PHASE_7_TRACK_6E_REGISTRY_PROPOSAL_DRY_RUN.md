# Phase 7 Track 6E - Controlled Registry Proposal Generator Dry-Run

Status: implemented and verified.

## Objective

Create a dry-run generator that transforms a Track 6C onboarding artifact into reviewable PayGate registry file proposals without mutating `registry/apps` by default.

This track implements the first safe bridge between the operator UI export and future controlled registry creation.

## Implemented scope

Track 6E adds:

- `scripts/onboarding-registry-proposal.ts`
- `npm run proposal:dry-run`
- unit tests in `tests/unit/onboarding-registry-proposal.test.ts`

The generator can:

1. Load an exported onboarding artifact.
2. Validate that it is a Track 6C-style artifact:
   - `status: draft_preview_only`
   - `non_mutating: true`
   - no secret-looking values
   - safe app/provider/plan/item fields
   - lookup keys instead of provider price IDs
3. Produce reviewable proposed registry files in memory:
   - `app.yaml`
   - `plans.yaml`
   - `entitlements.yaml`
   - `integration.yaml`
   - `files.manifest.yaml`
   - `env.example`
   - `integration-status.md`
   - optional `items.yaml`
4. Print a JSON dry-run summary to the terminal.
5. Optionally write dry-run output to a separate review directory when `--out-dir` is provided.

## Non-mutating default

Default command:

```powershell
npm run proposal:dry-run -- path\to\onboarding-artifact.json
```

Default behavior:

- Reads artifact.
- Validates artifact.
- Generates proposal in memory.
- Prints file list and warnings.
- Does not write registry files.
- Does not call Stripe.
- Does not configure Vercel.
- Does not deploy.

Optional review output:

```powershell
npm run proposal:dry-run -- path\to\onboarding-artifact.json --out-dir C:\Users\user\Documents\PayGate Proposal Reviews\example_app
```

The optional output directory must not be inside `registry/`.

## Safety gates

The dry-run generator refuses:

- artifacts without `non_mutating: true`;
- artifacts not marked `draft_preview_only`;
- Stripe/API/webhook secret-looking values such as `sk_test_`, `sk_live_`, `rk_test_`, `rk_live_`, or `whsec_`;
- unsafe app IDs;
- unsafe provider aliases;
- non-HTTPS origins;
- invalid plan pricing;
- provider price IDs where lookup keys are required;
- writing dry-run output into `registry/`.

## Important compatibility note

Older exported drafts from before Track 6C are intentionally rejected because they do not contain `non_mutating: true` and the hardened artifact sections.

The operator should generate a fresh artifact from the current `/admin` onboarding workspace before using Track 6E.

## Files changed

- `scripts/onboarding-registry-proposal.ts`
  - Adds the dry-run proposal generator and CLI.

- `package.json`
  - Adds `proposal:dry-run` script.

- `tests/unit/onboarding-registry-proposal.test.ts`
  - Verifies proposal mapping.
  - Verifies no registry mutation by default.
  - Verifies optional output writes only to a separate review directory.
  - Verifies secret-looking values are refused.
  - Verifies output inside `registry/` is refused.

- `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`
  - Marks Track 6E complete and adds Track 6F as the next gate.

- `docs/PRODUCT_COMPLETION_CHECKLIST.md`
  - Marks Track 6E complete.

- `docs/PRODUCT_ROADMAP_GRAPH.md`
  - Updates the roadmap to show Track 6E complete and Track 6F next.

## Acceptance checklist

- [x] Parse exported onboarding artifact safely.
- [x] Generate proposed `app.yaml`, `plans.yaml`, `entitlements.yaml`, `env.example`, integration docs, and optional `items.yaml`.
- [x] Show/write dry-run output without mutating registry by default.
- [x] Add explicit operator approval requirement for any future write mode.
- [x] Run validation/check commands after implementation.

## Next recommended track

Proceed to Phase 7 Track 6F - Operator Approval Gate for Registry Proposal Apply.

Track 6F should define and/or implement the explicit operator approval boundary required before any future workflow writes proposal files into `registry/apps`.
