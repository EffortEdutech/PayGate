# Phase 7 Track 4L - Multi-App Admin/Monitoring Verification and Freeze Prep

Status: accepted; operator API outputs reviewed on 2026-09-14.

## Objective

Close the remaining Phase 7 verification gates before a pageCast onboarding freeze/go-forward decision.

This track checks that PayGate can operate as a multi-app gateway from the operator view, not just as a single-app payment path.

## Why Single Cast remains deferred

Single Cast remains deferred because it is not the same shape as Cast Pass.

Cast Pass is app-wide and can safely use the current PayGate `plan_key` contract:

```txt
app_id + user_ref + plan_key = cast_pass_monthly
```

Single Cast is item-specific. PayGate must know exactly which book or bundle is being unlocked. The app must not send amount, currency, provider price ID, provider account, customer ID, or entitlement keys.

Before Single Cast can be activated, PayGate needs the future item/SKU contract documented in Track 4J:

- registry-owned `item_ref` resolution;
- PayGate-owned item price and Stripe lookup key;
- item-scoped entitlement projection, for example a specific `book_id`;
- refund/revocation behavior for that item;
- reconciliation and operator evidence for item purchases.

Until then, `single_cast_unlock` must stay `draft`.

## Why pageCast live payments remain deferred

pageCast live payments remain deferred because pageCast has only completed sandbox/test proof.

Live mode requires a separate live readiness gate because real money changes the risk level:

- live Stripe credentials and live webhook endpoint must be checked separately;
- live Product/Price lookup must be confirmed separately;
- the operator must approve a narrow live test window;
- support/rollback/evidence owners must be named;
- refund/reversal policy must be accepted;
- monitoring must be clean before and after the live test.

This is the same safety pattern used for AIntern. Sandbox success is necessary, but it does not automatically authorize live pageCast payments.

## Required operator verification commands

Run these from PowerShell with the current PayGate operator token.

```powershell
$operatorToken = "<OPERATOR_DIAGNOSTICS_TOKEN>"
$headers = @{ Authorization = "Bearer $operatorToken" }

$pagecastSummary = Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/summary?app_id=pagecast&environment=test" `
  -Headers $headers

$pagecastSummary | ConvertTo-Json -Depth 12

$pagecastMonitoring = Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/monitoring?app_id=pagecast&environment=test" `
  -Headers $headers

$pagecastMonitoring | ConvertTo-Json -Depth 12

$allAppsSummary = Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/summary?environment=test" `
  -Headers $headers

$allAppsSummary.apps | ConvertTo-Json -Depth 8
```

## Expected pageCast admin summary evidence

The pageCast summary should show:

- app `pagecast`;
- provider `stripe:nhl_global_solution`;
- `cast_pass_monthly` active;
- `single_cast_unlock` draft;
- environment `test` evidence;
- processed webhook rows for:
  - `customer.subscription.created`;
  - `checkout.session.completed`;
- customer/provider customer evidence;
- active subscription state for `cast_pass_monthly`;
- active entitlement evidence for Cast Pass.

## Expected pageCast monitoring evidence

The pageCast monitoring response should show:

- database reachable;
- no critical webhook alerts;
- no critical reconciliation alerts;
- no provider/account mixing;
- status `ok`, or only accepted non-critical historical warnings.

If there are alerts, Track 4L does not fail automatically. The operator must classify them:

| Alert type | Action |
| --- | --- |
| historical non-critical warning | record and accept if understood |
| failed webhook | investigate before freeze |
| failed reconciliation | investigate before freeze |
| runtime/database/provider error | block freeze until resolved |
| provider account mismatch | block freeze immediately |

## Expected multi-app admin evidence

The all-apps summary should prove PayGate can show at least:

- AIntern app registry/evidence;
- pageCast app registry/evidence;
- correct provider account aliases per app;
- no customer/subscription/entitlement leakage between apps;
- no app can control another app's commercial state.


## Reviewed operator evidence

Reviewed on 2026-09-14 from protected PayGate admin APIs.

### pageCast summary

- App: `pagecast`
- Provider account: `stripe:nhl_global_solution`
- Environment: `test`
- `cast_pass_monthly`: active, USD 19/month, subscription
- `single_cast_unlock`: draft, USD 3.99, payment
- Customer evidence exists for user `12f2abc4-3ae2-4bb7-b64f-867648639511`
- Provider customer: `cus_VErrcUhv4fvYXQ`
- Subscription state: `active`
- Processed webhooks:
  - `checkout.session.completed` / `evt_1UEO8sRgCMXjT1y6W8owwVpU`
  - `customer.subscription.created` / `evt_1UEO8rRgCMXjT1y6TgNIvjYF`

### pageCast monitoring

- Status: `ok`
- Database reachable: `true`
- Webhook failed/pending/retryable/dead-letter/unprocessed: `0/0/0/0/0`
- Reconciliation failed/no-provider-customer/no-provider-subscription: `0/0/0`
- Alerts: none

### Multi-app admin view

The all-apps test summary listed:

- `aintern` on `stripe:nhl_global_solution`
- `app_analytics_pro` on `stripe:primary`
- `pagecast` on `stripe:nhl_global_solution`

This confirms the admin view can show multiple apps and provider aliases without mixing their registry catalog state.
## Freeze prep decision

Track 4L can be accepted only after the operator provides or confirms:

- [x] pageCast admin summary output reviewed;
- [x] pageCast monitoring output reviewed;
- [x] all-apps admin view shows AIntern and pageCast safely;
- [x] no critical alerts remain unresolved;
- [x] Single Cast remains draft;
- [x] pageCast live mode remains blocked;
- [x] Phase 7 pageCast freeze/go-forward note can be prepared.

## Current decision state

Accepted.

Operator outputs confirmed pageCast admin summary, pageCast monitoring status `ok`, and all-apps summary with AIntern, Analytics Professional System, and pageCast listed separately.
