# Phase 7 Track 4F - pageCast Entitlement State Read/Display Evidence

Status: implemented; deployment verification pending.

## Scope

Track 4F connects pageCast to PayGate's provider-neutral state APIs so the app can display Cast Pass status from verified PayGate evidence.

This track is read/display only. It does not migrate per-book Single Cast unlocks and does not grant access from browser redirects.

## PayGate operator console fix - Track 4F-0

The operator console previously defaulted to `live`, which could show `No webhook evidence for this app` while pageCast sandbox/test webhook evidence existed.

Fixes:

- Operator console now defaults to `test`, matching current sandbox proof work.
- Webhook evidence rows include the event environment.
- If the selected environment has no webhook evidence, the UI now says: switch to `all` or check the other environment for sandbox/live evidence.
- Test coverage was added so the console shell keeps the test default and explanatory webhook empty-state text.

## pageCast app integration - Track 4F

pageCast commit: `c6d8d19` (`Display Cast Pass state from PayGate`)

Implemented files:

- `apps/reader-app/src/lib/paymentHub/client.ts`
- `apps/reader-app/src/app/api/paygate/state/route.ts`
- `apps/reader-app/src/app/pricing/page.tsx`

Behavior:

- pageCast server route `/api/paygate/state` authenticates the current Supabase user.
- The route calls PayGate using the user's Supabase JWT.
- It reads:
  - `/v1/subscriptions/current`
  - `/v1/entitlements`
- The pricing page displays active Cast Pass state from PayGate.
- The success return page displays whether PayGate state is active or still pending webhook state.
- If Cast Pass is active, the Cast Pass CTA becomes `Explore Premium Casts`.

## Boundary confirmation

pageCast still does not submit or control:

- amount;
- currency;
- Stripe Price ID;
- provider account;
- customer ID;
- entitlement keys;
- webhook processing;
- authoritative subscription state.

## Verification

PayGate:

- `npm run check` passed.
- Registry validation passed.
- Typecheck passed.
- 60 tests passed.

pageCast:

- `npm run build` passed in `apps/reader-app`.
- Build output includes `/api/paygate/state`.

## Not completed

- Premium Cast per-book unlock is not migrated to PayGate yet.
- Single Cast remains draft until a PayGate item/SKU contract exists.
- Final browser verification on deployed pageCast is pending after Vercel deploys pageCast commit `c6d8d19`.

## Next safe action

After deployment, verify:

1. PayGate `/admin` pageCast Webhook Evidence tab shows processed test webhooks or gives the correct environment guidance.
2. pageCast `/pricing` shows active Cast Pass state for the paid test user.
3. pageCast `/pricing?billing=success` shows `PayGate state: active Cast Pass` after webhook projection is available.