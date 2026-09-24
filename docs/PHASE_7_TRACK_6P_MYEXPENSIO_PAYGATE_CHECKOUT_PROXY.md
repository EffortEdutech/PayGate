# Phase 7 Track 6P - Implement MyExpensio Pro Sandbox PayGate Checkout Proxy

Status: complete.

Purpose: implement the first MyExpensio app-side PayGate checkout integration slice for Pro monthly sandbox checkout while preserving the existing direct Stripe checkout as rollback.

## Scope completed

Implemented in the MyExpensio repository only:

```text
C:\Users\user\Documents\00 Reimbursement Assistant\myexpensio
```

Implemented files:

- `apps/user/lib/paygate/checkout.ts`
- `apps/user/app/api/paygate/checkout/route.ts`
- `apps/user/app/api/billing/checkout/route.ts`
- `apps/user/.env.billing.example`
- `docs/04-billing-payments/02_PAYGATE_SANDBOX_CHECKOUT_PROXY.md`
- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md`

## Behavior

A new disabled-by-default PayGate checkout path now exists for the first controlled MyExpensio slice:

```text
app_id: myexpensio
plan_key: pro_monthly
MyExpensio tier: PRO
environment: test
entity_type: USER only
```

The existing UI can continue calling:

```text
POST /api/billing/checkout
```

When `PAYGATE_CHECKOUT_ENABLED=false`, the existing direct Stripe checkout behavior remains the default rollback path.

When `PAYGATE_CHECKOUT_ENABLED=true`, only `tier=PRO` and `entity_type=USER` delegates to the PayGate client. Premium, ORG/workspace subscriptions, portal, direct Stripe webhook, live payment, and refunds remain outside this change.

A direct proxy route was also added:

```text
POST /api/paygate/checkout
```

It is disabled unless `PAYGATE_CHECKOUT_ENABLED=true`.

## Security boundary

The MyExpensio server route forwards the current user's Supabase access token to PayGate as the bearer token. It does not expose or require a PayGate static app token in the browser.

The browser cannot control:

- PayGate `app_id`.
- PayGate `plan_key` beyond the server-side `PRO -> pro_monthly` mapping.
- PayGate environment beyond server config.
- Stripe price ID.
- Amount.
- Currency.
- Provider account.
- Entitlements.

PayGate still owns the commercial authority through the registry.

## MyExpensio env vars added to example

```ini
PAYGATE_BASE_URL=https://pay-gate-beta.vercel.app
PAYGATE_APP_ID=myexpensio
PAYGATE_ENVIRONMENT=test
PAYGATE_CHECKOUT_ENABLED=false
```

No Stripe secret, webhook secret, provider price ID, or PayGate operator token was added to browser-visible configuration.

## Explicitly not changed

- No PayGate code changed in this implementation step.
- No Stripe Product/Price mutation.
- No Vercel env mutation.
- No checkout execution.
- No live payment.
- No refund.
- No MyExpensio database schema change.
- No MyExpensio direct Stripe route removal.
- No Premium checkout migration.
- No ORG/workspace checkout migration.
- No PayGate portal migration.
- No entitlement bridge into MyExpensio feature gates yet.

## Verification

MyExpensio validation:

```powershell
corepack pnpm -C apps/user exec tsc --noEmit
```

Result: passed.

Graphify refresh:

```powershell
.\scripts\graphify.ps1 update .
```

Result: completed; graph updated with 6847 nodes and 9930 edges. Graph HTML generation was skipped because the graph exceeds the configured HTML visualization node limit.

PayGate validation after documentation update:

```powershell
npm run check
```

Result: registry validation, typecheck, and test suite passed.

## Remaining proof before enabling

Do not set `PAYGATE_CHECKOUT_ENABLED=true` until Track 6N evidence is green in the target deployment:

- Stripe sandbox Price lookup key `myexpensio_pro_monthly` exists and is active.
- PayGate Vercel env contains MyExpensio Supabase JWT routing.
- PayGate `/diagnostics/ready` is ready.
- PayGate `/diagnostics/runtime` shows `myexpensio` app auth readiness.
- PayGate admin summary shows MyExpensio registry data.

## Next documented step

Proceed to Phase 7 Track 6Q - MyExpensio Sandbox Checkout Evidence Run.

Track 6Q should guide the operator through setting the required non-secret MyExpensio env vars, enabling `PAYGATE_CHECKOUT_ENABLED=true` only in the sandbox deployment, starting one Pro checkout, completing Stripe sandbox payment, and collecting PayGate webhook/admin evidence. It must not include Premium, ORG/workspace, live payment, or refund work.
