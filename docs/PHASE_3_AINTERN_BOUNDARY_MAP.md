# Phase 3 AIntern Boundary Map

**Status:** COMPLETED FOR TRACK 2 DISCOVERY  
**Date:** 2026-08-27  
**Target app:** AIntern  
**AIntern path:** `C:\Users\user\Documents\00 aWL_platform\AIntern`  
**Payment Hub port:** `3017`  
**AIntern dev port:** `4900`

## Decision

AIntern will be the first real application integrated with the Central Payment Hub.

AIntern must not integrate Stripe directly. Stripe remains behind the Payment Hub provider adapter. AIntern consumes Hub-owned checkout, portal, subscription, entitlement, webhook, and reconciliation outcomes.


## Multi-Company Provider Account Boundary

The Payment Hub must support multiple Stripe/provider accounts because different companies may own different apps and settlement flows.

AIntern must not know the Stripe account directly. The Hub registry decides which provider account is used.

Target shape:

```text
AIntern -> Payment Hub -> stripe:nhl_global_solution
WorkLedger -> Payment Hub -> stripe:bina_jaya
Future app -> Payment Hub -> stripe:company_x
```

`provider.account: primary` is only a temporary local sandbox alias. Before production readiness, AIntern must be mapped to a named provider account owned by the correct company.

This means provider account configuration becomes part of the Hub authority boundary:

- provider credentials live in Hub configuration only;
- app registry declares the provider account name;
- webhook route remains account-scoped;
- reconciliation is account-scoped;
- apps cannot override provider account at request time.

## AIntern Current Monetization Shape

AIntern already has a local Phase 4 monetization model:

- Plans: `pass_3m` and `pass_6m`.
- Current user-facing component: `src/components/pass/PassSection.jsx`.
- Current client service: `src/services/api/entitlementService.js`.
- Current access hook: `src/hooks/useAccess.js`.
- Current database migration: `database/migrations/006_entitlements.sql`.
- Current activation path: promo/activation code via `redeem_promo_code`.
- Current server-side gates:
  - supervisor review request requires trial-or-pass;
  - official report snapshot creation requires trial-or-pass;
  - bundled AI requires pass, not trial.

This is useful and should not be thrown away. The Phase 3 integration should replace the payment acquisition path, not the whole access model in one jump.

## Identity Boundary

AIntern authenticated users are Supabase Auth users.

Payment Hub `user_ref` should be the Supabase Auth user id:

```text
AIntern Supabase auth.users.id -> Payment Hub user_ref
```

Reason:

- It is stable across devices.
- It is already the owner key for AIntern access and RLS.
- It avoids using email as billing authority.
- It allows reconciliation to target one intern/customer consistently.

## Integration Surface

### Payment Hub owns

- provider price lookup keys;
- Stripe customer creation;
- Stripe Checkout Session creation;
- Stripe webhook verification;
- provider event normalization;
- subscription projection;
- entitlement projection;
- billing portal session creation;
- reconciliation.

### AIntern owns

- intern login and profile through Supabase;
- UX placement of the billing section;
- local display of pass/trial state;
- feature gates in the UI;
- Supabase server-side gates for reviews, official versions, and bundled AI;
- immutable approved snapshots, evaluations, and report versions.

### AIntern must not own

- Stripe SDK;
- Stripe secret keys;
- Stripe webhook endpoint;
- provider price IDs;
- direct entitlement mutation from browser redirect success;
- arbitrary checkout amount/currency/return URLs.

## First Paid Plan Mapping

AIntern current plan keys should become Hub plan keys:

| AIntern concept | Hub plan key | Initial intent |
|---|---|---|
| 3-month internship pass | `pass_3m` | One short internship |
| 6-month internship pass | `pass_6m` | Longer placement / better value |

Current AIntern display prices are:

- `pass_3m`: RM39
- `pass_6m`: RM59

Provider price IDs or lookup keys must live in the Payment Hub registry only.

## Entitlement Mapping

The Hub should project at least these entitlements for AIntern:

| Entitlement | Meaning |
|---|---|
| `plan:pass_3m` | User has active 3-month pass subscription/payment state in Hub |
| `plan:pass_6m` | User has active 6-month pass subscription/payment state in Hub |
| `aintern:reviews` | Can request supervisor review after trial expires |
| `aintern:official_reports` | Can create official report versions after trial expires |
| `aintern:exports` | Can export official documents after trial expires |
| `aintern:bundled_ai` | Can use platform-bundled AI |

Implementation note: Phase 3 can initially consume `plan:pass_3m` / `plan:pass_6m` and map them inside AIntern, then later add richer Hub entitlement bundles if needed.

## Recommended AIntern Code Touchpoints

### Keep and adapt

- `src/components/pass/PassSection.jsx`
  - Replace activation-code-first UI with Checkout buttons.
  - Keep promo code as optional/manual pilot fallback if desired.
  - Add billing portal button once Hub has provider customer state.

- `src/services/api/entitlementService.js`
  - Add Hub calls for checkout, portal, and Hub entitlement reads.
  - Keep Supabase `get_access_state()` while transition is in progress.

- `src/hooks/useAccess.js`
  - Continue powering UX gates.
  - Later merge Supabase local access state with Hub entitlement state.

### Avoid for first integration

- Do not add Stripe packages to AIntern.
- Do not add Stripe webhooks to AIntern.
- Do not rewrite AIntern DB gates until Hub-to-Supabase activation is explicitly designed.

## Open Design Point Before Implementation

AIntern currently gates server-side using Supabase `public.entitlements`. Payment Hub projects entitlements in its own repository.

For Phase 3, choose one of these bridging strategies:

1. **Client-visible Hub entitlement, Supabase gates unchanged during sandbox**
   - Fastest for UI checkout proof.
   - AIntern UI can show Hub active state.
   - Supabase server gates still require existing trial/promo/manual pass.

2. **Supabase Edge Function bridge from Hub proof to AIntern entitlement row**
   - More complete.
   - After Hub webhook/reconciliation proves payment, a trusted server bridge inserts AIntern `entitlements` with `source='payment'` and `payment_ref`.
   - Keeps AIntern server-side gates working.

3. **Move access-state authority fully to Payment Hub**
   - Cleanest long-term, but bigger change.
   - Requires rewriting Supabase gates and Edge Functions to call/trust Hub.

Recommendation: use option 2 for production-shaped Phase 3, but do option 1 first if we want a very quick visual checkout integration.

## Phase 3 Track 2 Checklist Result

- [x] Read AIntern project plan.
- [x] Read AIntern progress log.
- [x] Inspected AIntern auth context.
- [x] Inspected AIntern route structure.
- [x] Inspected AIntern entitlement migration.
- [x] Inspected current pass UI/service/hook.
- [x] Selected `auth.users.id` as Hub `user_ref`.
- [x] Identified `pass_3m` and `pass_6m` as first Hub plan keys.
- [x] Confirmed no direct Stripe should be added to AIntern.

## Next Track

Proceed to Phase 3 Track 3: create the AIntern Hub registry package.

That means adding AIntern as a second registered application in the Payment Hub registry with:

- `app_id`: `aintern`
- app token mapping in `.env.local`
- app URLs for test/live
- return contexts for billing success/cancel/portal
- plans `pass_3m` and `pass_6m`
- Stripe sandbox lookup keys to be filled from Stripe Dashboard
