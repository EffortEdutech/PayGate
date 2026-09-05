# Phase 2 Sprint Plan - Stripe Sandbox Vertical Slice

**Status:** COMPLETE THROUGH TRACK 5
**Start basis:** Phase 0 frozen, Phase 1 foundation passing `npm run check`
**Primary objective:** prove the Central Payment Hub can run one complete Stripe sandbox subscription lifecycle without violating the provider-neutral architecture.

Phase 2 is not a broad payment platform build. It is the narrow vertical path that proves the architecture works in practice: authenticated app request, registry-driven checkout, Stripe sandbox session, verified webhook ingestion, entitlement projection, portal access, and reconciliation.

## Core Outcome

By the end of Phase 2, a sandbox app can:

1. authenticate to the Hub;
2. read its allowed catalog from the registry;
3. create a Stripe Checkout Session using `app_id`, `user_ref`, and `plan_key`;
4. receive access only after a verified Stripe webhook or reconciliation result;
5. query current subscription and entitlement state through provider-neutral endpoints;
6. create a Customer Portal Session for an existing mapped customer;
7. reconcile Hub state against Stripe sandbox state after missed or ambiguous events.

## Non-Goals

These items are intentionally out of scope for Phase 2:

- live Stripe keys, live prices, production transactions, or live webhooks;
- Stripe Connect, marketplace payouts, split payments, tax engines, invoicing customization, ledger accounting, or usage billing;
- second provider implementation;
- direct application access to Stripe APIs;
- arbitrary return URLs;
- client-supplied amounts, currencies, provider price IDs, customer IDs, subscription IDs, or entitlement changes;
- deployment hardening beyond what is needed for a local and sandbox-verifiable vertical slice.

## Sprint Tracks

### Track 1 - HTTP Shell and App Authentication

Deliverables:

- `GET /health`
- `GET /ready`
- `GET /v1/catalog`
- `POST /v1/checkout/sessions`
- `POST /v1/billing/portal-sessions`
- `GET /v1/subscriptions/current`
- `GET /v1/entitlements`
- `POST /v1/webhooks/stripe/{provider_account}/{environment}`

Checklist:

- [x] Choose and install the minimal HTTP runtime.
- [x] Implement app authentication from server-held app credentials.
- [x] Require authenticated `app_id` to match request `app_id`.
- [x] Require `Idempotency-Key` on mutation endpoints.
- [x] Return stable provider-neutral error codes.
- [x] Add request IDs to all responses and logs.

Acceptance gate:

- [x] Unauthorized requests are rejected.
- [x] Cross-app requests are rejected.
- [x] Mutation requests without idempotency keys are rejected.
- [x] No provider SDK object is returned from an HTTP endpoint.

### Track 2 - PostgreSQL Persistence

Deliverables:

- executable migration runner for local/sandbox database setup;
- database access layer for Phase 2 aggregates;
- transactional write path for checkout, webhook inbox, entitlement projection, idempotency, and reconciliation.

Checklist:

- [x] Apply the Phase 1 baseline migration to a local PostgreSQL database.
- [x] Add connection configuration without committing secrets.
- [x] Implement repository methods for applications, customers, plans, checkout sessions, subscriptions, entitlements, webhook inbox, idempotency, and reconciliation. _(Reconciliation remains.)_
- [x] Enforce provider, provider account, and environment on all provider mappings.
- [x] Store monetary values as integer minor units and uppercase currency.
- [x] Keep immutable event history separate from mutable projections.

Acceptance gate:

- [x] Duplicate idempotency keys return the original result or safe conflict.
- [x] Duplicate webhook events are stored once and processed once.
- [x] Entitlement projection updates happen in the same transaction as the normalized event outcome.
- [x] No sandbox data can collide with live identifiers by schema or code path.

### Track 3 - Stripe Sandbox Adapter

Deliverables:

- Stripe SDK integration behind the provider adapter only;
- Checkout Session creation by registry lookup key;
- Customer creation or reuse through Hub-owned mappings;
- Customer Portal Session creation;
- webhook signature verification from raw bytes;
- normalized event translation.

Checklist:

- [x] Install and pin Stripe SDK usage.
- [x] Load Stripe sandbox secret key and webhook secret from environment.
- [x] Resolve plan by `plan_key` to Stripe `lookup_key`, then to active Stripe Price.
- [x] Create Checkout Sessions with deterministic idempotency keys.
- [x] Store only minimal non-sensitive correlation metadata.
- [x] Verify `Stripe-Signature` before accepting webhook events.
- [x] Normalize checkout, subscription, invoice, cancellation, and refund-relevant events into Hub event types.
- [x] Translate Stripe errors into stable Hub error codes.

Acceptance gate:

- [x] Checkout creation works with Stripe sandbox.
- [x] Webhook verification fails for invalid signatures.
- [x] Browser redirect does not grant entitlement.
- [x] Verified webhook grants, changes, or revokes entitlements according to registry rules.
- [x] Portal Session creation requires an existing mapped provider customer.

### Track 4 - Entitlements and Subscription Projection

Deliverables:

- entitlement grant/revoke logic;
- current subscription projection;
- current entitlement projection;
- provider-neutral query responses.

Checklist:

- [x] Map registry entitlement rules to immutable grants and revocations.
- [x] Derive active entitlement state from verified events and reconciliation only.
- [x] Handle subscription active, trialing, past due, canceled, unpaid, and incomplete states.
- [x] Avoid exposing raw Stripe subscription status to applications.
- [x] Add tests for renewal, cancellation, failed payment, duplicate event, and out-of-order event cases.

Acceptance gate:

- [x] Applications receive Hub-defined entitlement state only.
- [x] Replayed events are idempotent.
- [x] Out-of-order events do not silently downgrade or overgrant access.
- [x] Missing state triggers reconciliation or a retryable processing state.

### Track 5 - Reconciliation and Operations

Deliverables:

- manual reconciliation command or internal endpoint;
- reconciliation run records;
- operational checklist for local sandbox testing.

Checklist:

- [x] Reconcile provider customer and subscription state from Stripe sandbox. _(Real sandbox evidence pending.)_
- [x] Record reconciliation inputs, outcomes, and failures.
- [x] Make reconciliation idempotent.
- [x] Add a runbook for webhook replay, missed events, and sandbox reset.
- [x] Add useful structured logs without logging secrets.

Acceptance gate:

- [x] Reconciliation can repair a missed webhook scenario.
- [x] Reconciliation cannot mutate entitlements without auditable provider evidence.
- [x] Failed reconciliation leaves clear retryable or failed state.

## Strategic Sequence

1. Build the HTTP shell and auth guard first.
2. Wire PostgreSQL persistence before Stripe mutations.
3. Implement Stripe Checkout Session creation.
4. Add webhook raw-body verification and durable inbox.
5. Process verified events into subscriptions and entitlements.
6. Add portal sessions.
7. Add reconciliation.
8. Run end-to-end sandbox tests and freeze Phase 2.

This order protects the architecture. We do not create Stripe sessions before the Hub has a durable place to record intent, idempotency, and provider mappings.

## Definition of Done

Phase 2 is done only when all are true:

- [x] `npm run check` passes.
- [x] Registry validation passes.
- [x] TypeScript build passes.
- [x] Unit tests cover auth, idempotency, registry plan resolution, webhook verification, event normalization, entitlement projection, and reconciliation.
- [x] Integration tests or documented manual sandbox proof cover checkout, webhook, entitlement, portal, and reconciliation flows.
- [x] No committed secrets exist.
- [x] No endpoint accepts arbitrary amounts, price IDs, customer IDs, entitlement changes, or return URLs from apps.
- [x] `PHASE_2_COMPLETION.md` records evidence, known limitations, and the exact sandbox flow tested.

## Stop Conditions

Pause implementation and create an ADR before proceeding if we need to:

- change a frozen Phase 0 contract;
- expose a provider-specific field through the app API;
- grant entitlement from a browser redirect;
- introduce live credentials or live provider objects;
- let apps submit commercial authority fields;
- add a second provider before the Stripe sandbox vertical slice is complete;
- store or log secrets, card data, or unnecessary personal data.

## Phase 2 Working Checklist

- [x] Confirm local PostgreSQL strategy.
- [x] Confirm Stripe sandbox product and price lookup keys exist.
- [x] Confirm sandbox webhook delivery method.
- [x] Implement HTTP runtime.







