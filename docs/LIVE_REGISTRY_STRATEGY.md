# Live Registry Strategy

Status: implemented for Phase 5 Track 3 on 2026-09-06.

## Objective

PayGate must be able to resolve Stripe live Product/Price lookup safely while preserving the frozen authority boundary: applications submit only `app_id`, `user_ref`, and `plan_key`; PayGate owns amount, currency, mode, provider account, and provider lookup resolution.

## Decision

Each plan keeps the existing sandbox lookup key:

```yaml
provider:
  stripe:
    lookup_key: aintern_pass_3m
```

For live readiness, a plan may add an explicit live lookup key:

```yaml
provider:
  stripe:
    lookup_key: aintern_pass_3m
    live_lookup_key: aintern_pass_3m_live
```

If `live_lookup_key` is absent, PayGate treats the existing `lookup_key` as the effective live lookup key. This lets us use identical test/live lookup naming when Stripe catalogs are intentionally mirrored, while still supporting separate live naming later without changing app code.

## Guardrails

- Apps never submit Stripe Price IDs, lookup keys, amounts, currencies, provider accounts, customer IDs, or entitlement keys.
- Test and live lookup uniqueness are validated separately as `provider:test:<lookup_key>` and `provider:live:<effective_lookup_key>`.
- Plan amount, currency, checkout mode, entitlements, and provider lookup selection remain registry-owned.
- Live lookup configuration is not a live-payment approval. Phase 6 approval is still required before any live payment/refund execution.

## Operator Rule

When creating live Stripe Products/Prices, either:

1. reuse the same lookup keys as sandbox and omit `live_lookup_key`; or
2. create explicit live lookup keys and add `live_lookup_key` to the PayGate registry.

After changing registry plans, run:

```powershell
npm run validate:registry
npm run check
```