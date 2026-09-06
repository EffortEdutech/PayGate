# Central Payment Hub API v1

All application endpoints require an authenticated app identity. Mutation requests require `Idempotency-Key`; the authenticated app must match `app_id`.

## Public application surface

```text
GET  /v1/catalog
POST /v1/checkout/sessions
POST /v1/billing/portal-sessions
GET  /v1/subscriptions/current?user_ref=...
GET  /v1/entitlements?user_ref=...
GET  /health
GET  /ready
```

## Protected operator diagnostics

These endpoints are not part of the ordinary application API. They require `Authorization: Bearer <OPERATOR_DIAGNOSTICS_TOKEN>` and must not be called from browser app clients.

```text
GET  /diagnostics/runtime
GET  /diagnostics/ready
GET  /admin/summary
```

`GET /admin` serves a minimal read-only operator console shell. The shell stores the operator token only in browser tab memory and calls `/admin/summary` with a bearer token.

Provider ingress is unauthenticated at the app layer but signature authenticated:

```text
POST /v1/webhooks/stripe/{provider_account}/{environment}
```

Privileged operations live under `/internal/*` and never accept ordinary app credentials.

## Create checkout session

```json
{
  "app_id": "app_analytics_pro",
  "user_ref": "usr_abc123",
  "plan_key": "growth_monthly",
  "return_context": "billing"
}
```

```json
{
  "checkout_session_id": "cph_cs_01J...",
  "redirect_url": "https://checkout.stripe.com/...",
  "status": "open",
  "expires_at": "2026-08-26T12:30:00Z"
}
```

The request must not contain authoritative amount, currency, provider price/customer identifiers, entitlement, or provider status.

## Errors

Errors use stable codes:

```json
{
  "error": {
    "code": "PLAN_NOT_AVAILABLE",
    "message": "The requested plan is not available.",
    "request_id": "req_01J..."
  }
}
```

Provider error types are logged internally and translated. Applications must not branch on provider-specific exceptions.

