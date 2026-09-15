# Phase 7 Track 4M - pageCast Onboarding Freeze / Go-Forward Note

Status: freeze/go-forward prepared; operator acceptance pending.

## Decision

pageCast Cast Pass onboarding is ready to freeze for sandbox/test usage.

The proven and accepted scope is:

- PayGate registry package for `pagecast`.
- Provider account mapping: `stripe:nhl_global_solution`.
- Active Cast Pass plan: `cast_pass_monthly`.
- Stripe sandbox/test checkout through PayGate.
- Verified Stripe webhook processing through PayGate.
- Active subscription and entitlement projection through PayGate.
- pageCast pricing/status display from PayGate state.
- pageCast Premium Cast access enforcement from verified PayGate state.
- Operator/admin summary and monitoring evidence reviewed.
- Multi-app admin view confirms AIntern and pageCast can be inspected without mixing app catalog state.

## Freeze scope

Frozen for pageCast Cast Pass sandbox/test:

- `cast_pass_monthly` remains the active pageCast PayGate payment slice.
- pageCast must continue to consume PayGate states and entitlements, not raw Stripe objects.
- Browser return pages must not grant entitlement.
- PayGate remains authority for price, provider lookup, webhook processing, entitlement projection, monitoring, and operator evidence.

## Evidence chain

- Track 4C: `docs/PHASE_7_TRACK_4C_PAGECAST_SUPABASE_JWT_EVIDENCE.md`
- Track 4D: `docs/PHASE_7_TRACK_4D_PAGECAST_CAST_PASS_CLIENT_EVIDENCE.md`
- Track 4E: `docs/PHASE_7_TRACK_4E_PAGECAST_SANDBOX_PROOF_EVIDENCE.md`
- Track 4F: `docs/PHASE_7_TRACK_4F_PAGECAST_ENTITLEMENT_STATE_EVIDENCE.md`
- Track 4G: `docs/PHASE_7_TRACK_4G_PAGECAST_ACCESS_ENFORCEMENT_PLAN.md`
- Track 4H: `docs/PHASE_7_TRACK_4H_PAGECAST_ACCESS_ENFORCEMENT_EVIDENCE.md`
- Track 4I: `docs/PHASE_7_TRACK_4I_PAGECAST_OPERATOR_ADMIN_EVIDENCE.md`
- Track 4J: `docs/PHASE_7_TRACK_4J_PAGECAST_SINGLE_CAST_ITEM_SKU_CONTRACT_PLAN.md`
- Track 4K: `docs/PHASE_7_TRACK_4K_PAGECAST_ONBOARDING_CLOSURE_EVIDENCE_PACKET.md`
- Track 4L: `docs/PHASE_7_TRACK_4L_MULTI_APP_ADMIN_MONITORING_FREEZE_PREP.md`

## Accepted Track 4L evidence

Reviewed on 2026-09-14:

- pageCast admin summary reviewed.
- pageCast monitoring status: `ok`.
- Webhook failed/pending/retryable/dead-letter/unprocessed: `0/0/0/0/0`.
- Reconciliation failed/no-provider-customer/no-provider-subscription: `0/0/0`.
- Alerts: none.
- All-apps admin view includes AIntern, Analytics Professional System, and pageCast with provider account aliases preserved.

## `single_cast_unlock` readiness position

`single_cast_unlock` is ready for the next planning-to-implementation sequence, but it is not active and not authorized for payment yet.

Current registry state:

- Plan key: `single_cast_unlock`
- Status: `draft`
- Mode: `payment`
- Current placeholder amount: USD 3.99
- Reason for draft: item-specific purchase needs item/SKU authority.

The next implementation must not simply activate the existing draft plan. It must first implement the item-specific contract.

## `single_cast_unlock` go-forward requirements

Before activation, PayGate must support:

1. Registry-owned item catalog, probably:

```txt
registry/apps/pagecast/items.yaml
```

2. App checkout request with non-commercial item reference only:

```json
{
  "app_id": "pagecast",
  "user_ref": "<supabase-user-id>",
  "plan_key": "single_cast_unlock",
  "item_ref": "book:a2020000-0000-4000-8000-000000000001",
  "environment": "test"
}
```

3. PayGate-owned resolution of:

- item name;
- item type: book or bundle;
- amount;
- currency;
- Stripe lookup key;
- entitlement scope;
- item status.

4. Item-scoped entitlement projection, for example:

```json
{
  "key": "pagecast.cast.unlock",
  "state": "active",
  "scope": {
    "book_id": "a2020000-0000-4000-8000-000000000001"
  }
}
```

5. pageCast access API must allow only the matching book or matching bundle contents.

6. Refund/reversal policy must define how item entitlements are revoked or held for operator review.

## Explicitly not authorized by this freeze

- No pageCast live payment.
- No Single Cast payment activation.
- No dynamic app-submitted amount.
- No app-submitted Stripe Price ID.
- No app-submitted entitlement key.
- No arbitrary return URL.
- No browser-return entitlement grant.
- No refund or chargeback automation for item unlocks yet.

## Recommended next track

Phase 7 Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast.

Proposed first implementation checklist:

- [ ] Add `items.yaml` schema proposal for pageCast.
- [ ] Add registry validation for item keys, price, currency, lookup key, entitlement scope, and status.
- [ ] Keep all item statuses draft in the first commit.
- [ ] Add documentation examples for one book and one bundle.
- [ ] Do not touch Stripe or runtime checkout yet.

## Operator acceptance

Operator may accept this freeze/go-forward note when:

- pageCast Cast Pass sandbox/test onboarding is accepted as frozen;
- `single_cast_unlock` remains draft;
- Track 5A may begin as item/SKU registry contract work only.
