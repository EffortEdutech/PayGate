# Security Model

## Trust boundaries

Browser or mobile clients call their application backend. Application backends authenticate server-to-server to the Hub using short-lived, audience-bound credentials. The initial implementation uses signed JWT assertions; mTLS can be added for higher-assurance deployments.

The authenticated credential identifies the application. A caller cannot gain authority by placing another `app_id` in a URL or body.

## Checkout authority

The registry owns amounts, currencies, provider routing, lookup keys, and allowed return destinations. Callers provide a logical plan and an approved `return_context` only.

## Webhook ingress

1. Read the exact raw request bytes.
2. Resolve the provider account and environment from the endpoint.
3. Verify the provider signature and timestamp tolerance.
4. Reject failures without entering the trusted inbox.
5. Persist the authenticated event under a unique provider/account/environment/event key.
6. Acknowledge promptly and process asynchronously.

## Data handling

- Never store PAN, CVV, bank credentials, provider secrets, or application access tokens.
- Store provider object references only where operationally required.
- Treat provider metadata as non-secret correlation data with minimal personal information.
- Encrypt data in transit and sensitive fields at rest; redact structured logs.
- Audit privileged reads and all administrative mutations.

## Redirect and SSRF protection

Return URLs are built from registry origins and path templates. Arbitrary absolute URLs supplied by callers are rejected.

## Operational controls

Use least-privilege credentials, secret rotation, rate limiting, request-size limits, dependency scanning, database backups, dead-letter monitoring, and reconciliation alerts. Live-mode activation requires an explicit operational approval outside source control.

