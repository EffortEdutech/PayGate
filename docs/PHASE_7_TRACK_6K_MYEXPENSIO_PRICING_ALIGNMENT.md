# Phase 7 Track 6K - MyExpensio Pricing Alignment and Registry Apply Gate

Status: complete.

Purpose: resolve the MyExpensio Pro/Premium pricing mismatch before any registry apply.

## Decision

The operator corrected the MyExpensio pricing scheme:

- Pro = MYR 18/month
- Premium = MYR 29/month

The first PayGate slice remains `pro_monthly`, but its amount is corrected to MYR 18/month.

Premium remains deferred as `premium_monthly` at MYR 29/month until Pro proof passes.

## Corrected dry-run proposal

Review folder:

```text
C:\Users\user\Documents\PayGate Proposal Reviews\myexpensio\2026-09-24\
```

Corrected generated plan:

```yaml
plan_key: pro_monthly
name: MyExpensio Pro Monthly
type: subscription
pricing:
  currency: MYR
  unit_amount_minor: 1800
  interval: month
provider:
  stripe:
    lookup_key: myexpensio_pro_monthly
entitlement_bundle:
  - myexpensio.exports
status: draft
```

Dry-run result:

```text
status: dry_run_only
appId: myexpensio
targetDirectory: registry/apps/myexpensio
approvalPhraseRequiredForApply: APPLY REGISTRY PROPOSAL myexpensio
```

## Registry apply gate

The proposal is ready for review, but registry apply is still not automatic.

Applying the proposal requires exact operator approval phrase:

```text
APPLY REGISTRY PROPOSAL myexpensio
```

Registry apply must still not create Stripe products/prices, mutate Vercel env vars, deploy apps, run live payments, process refunds, or grant entitlements.

## Track 6K checklist

- [x] Decide whether `pro_monthly` should be MYR 29/month, or whether it should remain MYR 18/month as currently documented in the MyExpensio repo.
- [x] Decide whether MYR 29/month should instead be `premium_monthly`.
- [x] Regenerate the onboarding artifact and dry-run proposal with corrected plan amount.
- [x] Confirm proposed Stripe sandbox lookup key: `myexpensio_pro_monthly`.
- [x] Stop before registry apply unless operator explicitly authorizes `APPLY REGISTRY PROPOSAL myexpensio`.

## Next documented step

Proceed to Phase 7 Track 6L - MyExpensio Registry Apply Approval and Validation.

Track 6L should apply the reviewed draft registry package only if the operator explicitly approves the exact phrase, then run `npm run validate:registry` and `npm run check` before commit/deploy decisions.