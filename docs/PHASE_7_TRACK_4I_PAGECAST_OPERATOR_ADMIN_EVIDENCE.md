# Phase 7 Track 4I - pageCast Operator/Admin Evidence Polish

Status: completed for sandbox/test pageCast Cast Pass evidence.

## Objective

Make the operator evidence for pageCast clear enough that the app can be reviewed from PayGate without command-first investigation.

This track does not add live payment authorization, refund actions, registry mutation, Stripe catalog mutation, or Single Cast item/SKU checkout.

## Current environment

- App: `pagecast`
- Provider: `stripe:nhl_global_solution`
- Active PayGate plan: `cast_pass_monthly`
- Environment verified in this track: `test`
- Live pageCast payment is not authorized in this track.

## Operator evidence the console must support

The PayGate operator console/admin APIs should let the operator confirm:

1. pageCast appears in the app directory/admin summary.
2. `cast_pass_monthly` is active with:
   - mode: `subscription`
   - amount: USD 19.00/month
   - entitlements: `pagecast.cast_pass`, `pagecast.premium_casts`
3. `single_cast_unlock` remains draft/deferred.
4. Webhook evidence exists for the pageCast sandbox checkout:
   - `customer.subscription.created`
   - `checkout.session.completed`
   - status: `processed`
5. Customer/subscription evidence exists for the paid test user.
6. Monitoring for `app_id=pagecast&environment=test` has no critical alerts before proceeding.
7. The access proof from Track 4H is visible in documentation and linked to the operator decision trail.

## Accepted pageCast browser evidence

Premium Cast:

- `https://pagecast-nine.vercel.app/book/a2020000-0000-4000-8000-000000000001`

Unpaid state:

- CTA: `Unlock Cast for $9.99`
- Secondary action: `Get Cast Pass`

Paid Cast Pass state:

- CTA: `Read with Cast Pass`
- Reader target: `https://pagecast-nine.vercel.app/reader/a2020000-0000-4000-8000-000000000001`

## Operator review commands

Use the protected PayGate operator session in `/admin`, or use these API checks with the operator token.

```powershell
$operatorToken = "<OPERATOR_DIAGNOSTICS_TOKEN>"
$headers = @{ Authorization = "Bearer $operatorToken" }

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/summary?app_id=pagecast&environment=test" `
  -Headers $headers

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/monitoring?app_id=pagecast&environment=test" `
  -Headers $headers
```

Expected result:

- Admin summary shows pageCast registry, customer/subscription/entitlement/webhook evidence.
- Monitoring status is `ok` or contains only accepted non-critical historical warnings.
- No provider secrets, webhook secrets, database credentials, or raw Stripe objects are exposed.

## Boundaries preserved

- pageCast does not send amount, currency, Stripe price ID, provider account, customer ID, or entitlement keys.
- PayGate remains the authority for plan lookup, webhook verification, entitlement projection, monitoring, and operator evidence.
- Browser return pages and CTA states do not create financial entitlement.
- Single Cast remains blocked until a future item/SKU contract exists.
- Live pageCast checkout remains blocked until a separate live readiness gate is approved.

## Checklist

- [x] Record pageCast app/provider/plan evidence expectations.
- [x] Record paid/unpaid Premium Cast access evidence.
- [x] Record operator admin/monitoring review commands.
- [x] Record deferred Single Cast boundary.
- [x] Record live-mode hold boundary.

## Next documented step

Proceed to Phase 7 Track 4J - Single Cast item/SKU contract plan, or complete the broader multi-app admin/monitoring verification gate if the operator wants to close pageCast onboarding first.
