import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Environment, HubErrorShape } from "@payment-hub/types";
import type { AppAuthenticator } from "../security/app-authentication.js";
import { assertAppAuthority, readBearerToken } from "../security/app-authentication.js";
import type { IdempotencyLedger, IdempotencyScope } from "../security/idempotency.js";
import { IdempotencyConflictError, InMemoryIdempotencyLedger } from "../security/idempotency.js";
import { RegistryError } from "../registry/registry.js";
import { PaymentHubService, PaymentHubServiceError } from "../services/payment-hub-service.js";
import { CONSOLE_APP_JS, CONSOLE_HTML } from "./console-ui.js";

export interface HttpServerDependencies {
  readonly service: PaymentHubService;
  readonly authenticator: AppAuthenticator;
  readonly idempotencyLedger?: IdempotencyLedger;
}

interface RecentWebhookProof {
  readonly provider_event_id: string;
  readonly event_type: string;
  readonly provider_account: string;
  readonly environment: Environment;
  readonly app_id?: string;
  readonly user_ref?: string;
  readonly duplicate: boolean;
  readonly received_at: string;
}

export function createPaymentHubHttpHandler(deps: HttpServerDependencies) {
  const idempotencyLedger = deps.idempotencyLedger ?? new InMemoryIdempotencyLedger();
  const recentWebhooks: RecentWebhookProof[] = [];
  return async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = req.headers["x-request-id"]?.toString() || `req_${randomUUID()}`;
    try {
      await routeRequest(req, res, requestId, deps, idempotencyLedger, recentWebhooks);
    } catch (error) {
      writeError(res, requestId, error);
    }
  };
}

export function createPaymentHubHttpServer(deps: HttpServerDependencies) {
  return createServer(createPaymentHubHttpHandler(deps));
}

async function routeRequest(req: IncomingMessage, res: ServerResponse, requestId: string, deps: HttpServerDependencies, idempotencyLedger: IdempotencyLedger, recentWebhooks: RecentWebhookProof[]): Promise<void> {
  const url = new URL(req.url ?? "/", "http://payment-hub.local");
  if (req.method === "OPTIONS") return writeNoContent(res, 204);
  if (req.method === "GET" && (url.pathname === "/console" || url.pathname === "/console/")) return writeHtml(res, 200, CONSOLE_HTML);
  if (req.method === "GET" && url.pathname === "/console/app.js") return writeJavaScript(res, 200, CONSOLE_APP_JS);
  if (req.method === "GET" && url.pathname === "/console/api/recent-webhooks") return writeJson(res, 200, { webhooks: recentWebhooks });
  if (req.method === "GET" && url.pathname === "/health") return writeJson(res, 200, { status: "ok", request_id: requestId });
  if (req.method === "GET" && url.pathname === "/ready") return writeJson(res, 200, { status: "ready", request_id: requestId });

  if (req.method === "POST" && url.pathname.startsWith("/v1/webhooks/stripe/")) {
    const [, , , , providerAccount, environment] = url.pathname.split("/");
    if (!providerAccount || !isEnvironment(environment)) throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found");
    const signature = req.headers["stripe-signature"]?.toString();
    if (!signature) throw new HttpError(400, "MISSING_WEBHOOK_SIGNATURE", "Missing Stripe-Signature header");
    const rawBody = await readRawBody(req);
    const accepted = await deps.service.acceptWebhook({ rawBody, signature, providerAccount, environment });
    recentWebhooks.unshift({
      provider_event_id: accepted.event.providerEventId,
      event_type: accepted.event.eventType,
      provider_account: accepted.event.providerAccount,
      environment: accepted.event.environment,
      ...(accepted.event.payload.appId ? { app_id: accepted.event.payload.appId } : {}),
      ...(accepted.event.payload.userRef ? { user_ref: accepted.event.payload.userRef } : {}),
      duplicate: accepted.duplicate,
      received_at: new Date().toISOString(),
    });
    recentWebhooks.splice(20);
    return writeJson(res, 200, { received: true, duplicate: accepted.duplicate, request_id: requestId });
  }

  const identity = await deps.authenticator.authenticate(readBearerToken(req.headers.authorization));

  if (req.method === "GET" && url.pathname === "/v1/catalog") {
    const appId = requiredQuery(url, "app_id");
    const environment = readEnvironment(url);
    assertAppAuthority(identity, appId);
    return writeJson(res, 200, deps.service.catalog(appId, environment));
  }

  if (req.method === "GET" && url.pathname === "/v1/subscriptions/current") {
    const appId = requiredQuery(url, "app_id");
    const userRef = requiredQuery(url, "user_ref");
    assertAppAuthority(identity, appId, userRef);
    return writeJson(res, 200, await deps.service.currentSubscription(appId, userRef));
  }

  if (req.method === "GET" && url.pathname === "/v1/entitlements") {
    const appId = requiredQuery(url, "app_id");
    const userRef = requiredQuery(url, "user_ref");
    assertAppAuthority(identity, appId, userRef);
    return writeJson(res, 200, await deps.service.currentEntitlements(appId, userRef));
  }

  if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const body = await readJsonBody(req);
    const appId = requiredBodyString(body, "app_id");
    const userRef = requiredBodyString(body, "user_ref");
    const planKey = requiredBodyString(body, "plan_key");
    const returnContext = requiredBodyString(body, "return_context");
    assertAppAuthority(identity, appId, userRef);
    const scope = requireIdempotencyScope(req, appId, "checkout.create");
    return runIdempotentMutation(res, idempotencyLedger, scope, body, async () => {
      const result = await deps.service.createCheckout({ requestId, appId, userRef, planKey, returnContext, environment: readBodyEnvironment(body) });
      return { checkout_session_id: result.checkoutSessionId, redirect_url: result.redirectUrl.href, status: result.status, expires_at: result.expiresAt.toISOString() };
    });
  }

  if (req.method === "POST" && url.pathname === "/internal/reconciliation/run") {
    const body = await readJsonBody(req);
    const appId = requiredBodyString(body, "app_id");
    const userRef = requiredBodyString(body, "user_ref");
    assertAppAuthority(identity, appId, userRef);
    const scope = requireIdempotencyScope(req, appId, "reconciliation.run");
    return runIdempotentMutation(res, idempotencyLedger, scope, body, async () => {
      const result = await deps.service.reconcile({ requestId, appId, userRef, environment: readBodyEnvironment(body) });
      return {
        reconciliation_run_id: result.runId,
        app_id: result.appId,
        user_ref: result.userRef,
        status: result.status,
        subscription: result.subscription,
      };
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/billing/portal-sessions") {
    const body = await readJsonBody(req);
    const appId = requiredBodyString(body, "app_id");
    const userRef = requiredBodyString(body, "user_ref");
    const returnContext = requiredBodyString(body, "return_context");
    assertAppAuthority(identity, appId, userRef);
    const scope = requireIdempotencyScope(req, appId, "portal.create");
    return runIdempotentMutation(res, idempotencyLedger, scope, body, async () => {
      const result = await deps.service.createPortal({ requestId, appId, userRef, returnContext, environment: readBodyEnvironment(body) });
      return { portal_session_id: result.portalSessionId, redirect_url: result.redirectUrl.href };
    });
  }

  throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found");
}

function requireIdempotencyScope(req: IncomingMessage, appId: string, operation: string): IdempotencyScope {
  const key = req.headers["idempotency-key"]?.toString();
  if (!key) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Mutation requests require Idempotency-Key");
  return { appId, operation, key };
}

async function runIdempotentMutation(res: ServerResponse, ledger: IdempotencyLedger, scope: IdempotencyScope, requestBody: unknown, action: () => Promise<unknown>): Promise<void> {
  const begun = await ledger.begin(scope, requestBody);
  if (begun.kind === "replay" && begun.record.responseStatus && begun.record.responseBody !== undefined) return writeJson(res, begun.record.responseStatus, withRequestId(begun.record.responseBody, scope.key));
  try {
    const responseBody = withRequestId(await action(), scope.key);
    await ledger.complete(scope, 200, responseBody);
    return writeJson(res, 200, responseBody);
  } catch (error) {
    await ledger.fail(scope);
    throw error;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = Buffer.from(await readRawBody(req)).toString("utf8");
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function readRawBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBodyEnvironment(body: Record<string, unknown>): Environment {
  const value = body.environment ?? "test";
  if (!isEnvironment(value)) throw new HttpError(400, "INVALID_ENVIRONMENT", "environment must be test or live");
  return value;
}

function readEnvironment(url: URL): Environment {
  const value = url.searchParams.get("environment") ?? "test";
  if (!isEnvironment(value)) throw new HttpError(400, "INVALID_ENVIRONMENT", "environment must be test or live");
  return value;
}

function isEnvironment(value: unknown): value is Environment {
  return value === "test" || value === "live";
}

function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) throw new HttpError(400, "MISSING_PARAMETER", `Missing query parameter ${name}`);
  return value;
}

function requiredBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value) throw new HttpError(400, "INVALID_REQUEST", `${key} is required`);
  return value;
}

function writeHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, withCors({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }));
  res.end(body);
}

function writeJavaScript(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, withCors({ "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" }));
  res.end(body);
}

function writeNoContent(res: ServerResponse, status: number): void {
  res.writeHead(status, withCors({ "cache-control": "no-store" }));
  res.end();
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const requestId = typeof body === "object" && body !== null && "request_id" in body && typeof body.request_id === "string" ? body.request_id : undefined;
  res.writeHead(status, withCors({ "content-type": "application/json", ...(requestId ? { "x-request-id": requestId } : {}) }));
  res.end(JSON.stringify(body));
}

function writeError(res: ServerResponse, requestId: string, error: unknown): void {
  if (!(error instanceof HttpError) && !(error instanceof IdempotencyConflictError) && !(error instanceof RegistryError) && !(error instanceof PaymentHubServiceError)) {
    console.error("Payment Hub internal error", { requestId, error });
  }
  if (error instanceof HttpError) return writeJson(res, error.status, { error: shapeError(error.code, error.message, requestId) });
  if (error instanceof IdempotencyConflictError) return writeJson(res, 409, { error: shapeError(error.code, error.message, requestId) });
  if (error instanceof RegistryError || error instanceof PaymentHubServiceError) return writeJson(res, 400, { error: shapeError(error.code, error.message, requestId) });
  if (isProviderRuntimeError(error)) return writeJson(res, 400, { error: shapeError(error.code, error.message, requestId) });
  if (error instanceof Error && error.name.includes("Authentication")) return writeJson(res, 401, { error: shapeError("UNAUTHENTICATED", error.message, requestId) });
  if (error instanceof Error && error.name.includes("Authorization")) return writeJson(res, 403, { error: shapeError("FORBIDDEN", error.message, requestId) });
  return writeJson(res, 500, { error: shapeError("INTERNAL_ERROR", "Internal server error", requestId) });
}

function withRequestId(body: unknown, requestId: string): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body) || "request_id" in body) return body;
  return { ...body, request_id: requestId };
}

function withCors(headers: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    "access-control-allow-origin": process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN?.trim() || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id",
    "access-control-expose-headers": "x-request-id",
  };
}

function isProviderRuntimeError(error: unknown): error is { readonly code: string; readonly message: string } {
  return error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("PROVIDER_");
}

function shapeError(code: string, message: string, requestId: string): HubErrorShape {
  return { code, message, requestId };
}
class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}





