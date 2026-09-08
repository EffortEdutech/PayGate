import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type RuntimeModule = typeof import("../payment-hub/src/runtime/runtime.js");
type ServerModule = typeof import("../payment-hub/src/server/http-server.js");
type PaymentHubRuntime = Awaited<ReturnType<RuntimeModule["createPostgresPaymentHubRuntime"]>>;

let runtimePromise: Promise<PaymentHubRuntime> | undefined;
let handlerPromise: Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> | undefined;

async function getRuntime(): Promise<PaymentHubRuntime> {
  runtimePromise ??= import("../payment-hub/src/runtime/runtime.js").then((runtimeModule) => runtimeModule.createPostgresPaymentHubRuntime(process.env, process.cwd()));
  return runtimePromise;
}

async function getHandler() {
  handlerPromise ??= Promise.all([
    getRuntime(),
    import("../payment-hub/src/server/http-server.js") as Promise<ServerModule>,
  ]).then(([runtime, serverModule]) => serverModule.createPaymentHubHttpHandler({
    service: runtime.service,
    authenticator: runtime.authenticator,
    idempotencyLedger: runtime.idempotencyLedger,
  }));
  return handlerPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestId = req.headers["x-request-id"]?.toString() || `req_${randomUUID()}`;
  const url = new URL(req.url ?? "/", "https://paygate.local");

  if (req.method === "OPTIONS") return writeJson(res, 204, undefined);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return writeJson(res, 200, {
      status: "ok",
      service: "paygate-payment-hub",
      runtime: "vercel",
      request_id: requestId,
    });
  }

  if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    return writeHtml(res, 200, ADMIN_HTML);
  }

  if (req.method === "POST" && url.pathname === "/admin/session/login") {
    return handleAdminSessionLogin(req, res, requestId);
  }

  if (req.method === "POST" && url.pathname === "/admin/session/logout") {
    return handleAdminSessionLogout(res);
  }

  if (req.method === "GET" && url.pathname === "/admin/session") {
    const authError = requireOperatorDiagnosticsAuth(req, requestId);
    if (authError) return writeJson(res, authError.status, authError.body);
    return writeJson(res, 200, { status: "authenticated", request_id: requestId });
  }

  if (req.method === "GET" && url.pathname === "/admin/monitoring") {
    const authError = requireOperatorDiagnosticsAuth(req, requestId);
    if (authError) return writeJson(res, authError.status, authError.body);
    try {
      const runtime = await getRuntime();
      return writeJson(res, 200, await runtime.service.monitoringSummary({ appId: optionalQuery(url, "app_id"), environment: optionalEnvironment(url) }));
    } catch (error) {
      console.error("PayGate monitoring summary failed", { requestId, error });
      return writeJson(res, 503, {
        error: {
          code: "MONITORING_RUNTIME_NOT_READY",
          message: "PayGate monitoring summary is not ready. Check protected diagnostics and deployment configuration.",
          requestId,
        },
      });
    }
  }
  if (req.method === "GET" && url.pathname === "/admin/summary") {
    const authError = requireOperatorDiagnosticsAuth(req, requestId);
    if (authError) return writeJson(res, authError.status, authError.body);
    try {
      const runtime = await getRuntime();
      return writeJson(res, 200, await runtime.service.adminDashboard({ appId: optionalQuery(url, "app_id"), environment: optionalEnvironment(url), limit: optionalLimit(url) }));
    } catch (error) {
      console.error("PayGate admin summary failed", { requestId, error });
      return writeJson(res, 503, {
        error: {
          code: "ADMIN_RUNTIME_NOT_READY",
          message: "PayGate admin summary is not ready. Check protected diagnostics and deployment configuration.",
          requestId,
        },
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/diagnostics/runtime") {
    const authError = requireOperatorDiagnosticsAuth(req, requestId);
    if (authError) return writeJson(res, authError.status, authError.body);
    return writeJson(res, 200, runtimeDiagnostics(requestId));
  }

  if (req.method === "GET" && url.pathname === "/diagnostics/ready") {
    const authError = requireOperatorDiagnosticsAuth(req, requestId);
    if (authError) return writeJson(res, authError.status, authError.body);
    return writeJson(res, 200, await readinessDiagnostics(requestId));
  }

  if (url.pathname.startsWith("/v1/webhooks/stripe/") && req.method !== "POST") {
    return writeJson(res, 405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Stripe webhooks must be sent as signed POST requests. This endpoint is not a browser page.",
        requestId,
      },
    });
  }

  try {
    const paymentHubHandler = await getHandler();
    await paymentHubHandler(req, res);
  } catch (error) {
    console.error("PayGate runtime initialization failed", { requestId, error });
    return writeJson(res, 503, {
      error: {
        code: "RUNTIME_NOT_READY",
        message: "Payment Hub runtime is not ready. Check /diagnostics/runtime for safe configuration diagnostics.",
        requestId,
      },
    });
  }
}

const ADMIN_SESSION_COOKIE = "paygate_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

async function handleAdminSessionLogin(req: IncomingMessage, res: ServerResponse, requestId: string): Promise<void> {
  const configuredToken = process.env.OPERATOR_DIAGNOSTICS_TOKEN?.trim();
  if (!configuredToken) {
    return writeJson(res, 503, {
      error: {
        code: "DIAGNOSTICS_AUTH_NOT_CONFIGURED",
        message: "Operator login is protected, but OPERATOR_DIAGNOSTICS_TOKEN is not configured.",
        requestId,
      },
    });
  }

  let body: { readonly token?: unknown } = {};
  try {
    body = JSON.parse(await readRequestBody(req)) as { readonly token?: unknown };
  } catch {
    return writeJson(res, 400, {
      error: {
        code: "INVALID_LOGIN_REQUEST",
        message: "Operator login expects JSON with a token field.",
        requestId,
      },
    });
  }

  const presentedToken = typeof body.token === "string" ? body.token.trim() : "";
  if (!presentedToken || !constantTimeEqual(presentedToken, configuredToken)) {
    return writeJson(res, 401, {
      error: {
        code: "UNAUTHORIZED",
        message: "Operator login failed.",
        requestId,
      },
    });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const session = signAdminSession({ exp: expiresAt });
  writeJson(res, 200, { status: "authenticated", expires_at: new Date(expiresAt * 1000).toISOString(), request_id: requestId }, [adminSessionCookie(session, ADMIN_SESSION_TTL_SECONDS)]);
}

function handleAdminSessionLogout(res: ServerResponse): void {
  writeJson(res, 200, { status: "signed_out" }, [`${ADMIN_SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`]);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 10_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function adminSessionCookie(session: string, maxAgeSeconds: number): string {
  return `${ADMIN_SESSION_COOKIE}=${session}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function signAdminSession(payload: { readonly exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", operatorSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyAdminSession(session: string | undefined): boolean {
  if (!session) return false;
  const [encoded, signature] = session.split(".", 2);
  if (!encoded || !signature) return false;
  const expected = createHmac("sha256", operatorSessionSecret()).update(encoded).digest("base64url");
  if (!constantTimeEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { readonly exp?: unknown };
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function operatorSessionSecret(): string {
  return process.env.OPERATOR_DIAGNOSTICS_TOKEN?.trim() || "paygate-session-not-configured";
}

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const cookieHeader = req.headers.cookie?.toString();
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return rawValue.join("=");
  }
  return undefined;
}
type DiagnosticsAuthError = {
  readonly status: 401 | 503;
  readonly body: {
    readonly error: {
      readonly code: "UNAUTHORIZED" | "DIAGNOSTICS_AUTH_NOT_CONFIGURED";
      readonly message: string;
      readonly requestId: string;
    };
  };
};

function requireOperatorDiagnosticsAuth(req: IncomingMessage, requestId: string): DiagnosticsAuthError | undefined {
  const configuredToken = process.env.OPERATOR_DIAGNOSTICS_TOKEN?.trim();
  if (!configuredToken) {
    return {
      status: 503,
      body: {
        error: {
          code: "DIAGNOSTICS_AUTH_NOT_CONFIGURED",
          message: "Operator diagnostics are protected, but OPERATOR_DIAGNOSTICS_TOKEN is not configured.",
          requestId,
        },
      },
    };
  }

  const authorization = req.headers.authorization?.toString() ?? "";
  const [scheme, presentedToken] = authorization.split(/\s+/, 2);
  const bearerOk = scheme === "Bearer" && Boolean(presentedToken) && constantTimeEqual(presentedToken, configuredToken);
  const sessionOk = verifyAdminSession(readCookie(req, ADMIN_SESSION_COOKIE));
  if (!bearerOk && !sessionOk) {
    return {
      status: 401,
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "Operator diagnostics require a valid bearer token or admin session.",
          requestId,
        },
      },
    };
  }

  return undefined;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
function runtimeDiagnostics(requestId: string): unknown {
  const accounts = splitCsv(process.env.STRIPE_ACCOUNTS);
  const liveAccounts = splitCsv(process.env.STRIPE_LIVE_ACCOUNTS);
  const checks = [
    checkPlainUrl("APP_AUTH_ISSUER", process.env.APP_AUTH_ISSUER, true),
    checkPlainUrl("PAYMENT_HUB_CORS_ALLOW_ORIGIN", process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN, false),
    checkPlainUrl("SUPABASE_JWKS_URL", process.env.SUPABASE_JWKS_URL, true),
    checkPlainUrl("SUPABASE_JWT_ISSUER", process.env.SUPABASE_JWT_ISSUER, true),
    checkRequired("APP_AUTH_AUDIENCE", process.env.APP_AUTH_AUDIENCE),
    checkRequired("SUPABASE_JWT_APP_ID", process.env.SUPABASE_JWT_APP_ID),
    checkRequired("SUPABASE_JWT_AUDIENCE", process.env.SUPABASE_JWT_AUDIENCE),
    checkStripeAccounts(accounts),
    checkStripeLiveAccounts(liveAccounts),
    checkDatabaseUrl(process.env.DATABASE_URL),
    liveReadinessSummary(accounts, liveAccounts),
    ...accounts.flatMap((account) => [
      checkSecret(envNameForProviderAccount(account, "SECRET_KEY"), process.env[envNameForProviderAccount(account, "SECRET_KEY")], "sk_test_"),
      checkSecret(envNameForProviderAccount(account, "WEBHOOK_SECRET"), process.env[envNameForProviderAccount(account, "WEBHOOK_SECRET")], "whsec_"),
    ]),
    ...liveAccounts.flatMap((account) => [
      checkNamedLiveAccount(account),
      checkSecret(liveEnvNameForProviderAccount(account, "SECRET_KEY"), process.env[liveEnvNameForProviderAccount(account, "SECRET_KEY")], "sk_live_"),
      checkSecret(liveEnvNameForProviderAccount(account, "WEBHOOK_SECRET"), process.env[liveEnvNameForProviderAccount(account, "WEBHOOK_SECRET")], "whsec_"),
    ]),
  ];
  return {
    status: checks.every((check) => check.ok) ? "config_shape_ok" : "config_shape_failed",
    service: "paygate-payment-hub",
    request_id: requestId,
    checks,
  };
}


async function readinessDiagnostics(requestId: string): Promise<unknown> {
  const checks: Array<Record<string, unknown>> = [];
  try {
    const pgModule = await import("pg");
    const pool = new pgModule.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query("select current_database() as database, current_user as user, version() as version");
      checks.push({ name: "DATABASE_CONNECT", ok: true, database: result.rows[0]?.database, user: result.rows[0]?.user, version: String(result.rows[0]?.version ?? "").split(" ").slice(0, 2).join(" ") });
    } finally {
      await pool.end();
    }
  } catch (error) {
    checks.push(safeErrorCheck("DATABASE_CONNECT", error));
  }

  try {
    const runtimeModule = await import("../payment-hub/src/runtime/runtime.js");
    const runtime = await runtimeModule.createPostgresPaymentHubRuntime(process.env, process.cwd());
    checks.push({ name: "RUNTIME_CREATE", ok: true, stripe_accounts: runtime.config.stripeAccounts.map((account: { account: string }) => account.account), stripe_live_accounts: runtime.config.stripeLiveAccounts.map((account: { account: string }) => account.account), live_config_present: runtime.config.stripeLiveAccounts.length > 0, live_webhook_boundary: runtime.config.stripeLiveAccounts.length > 0 ? "live_checkout_and_webhook" : "not_configured", live_checkout_enabled: runtime.config.stripeLiveAccounts.length > 0, live_portal_enabled: runtime.config.stripeLiveAccounts.length > 0, live_reconciliation_enabled: runtime.config.stripeLiveAccounts.length > 0, phase6_approval_required: true, supabase_jwks: Boolean(runtime.config.supabaseJwtAuth?.jwksUrl) });
  } catch (error) {
    checks.push(safeErrorCheck("RUNTIME_CREATE", error));
  }

  return {
    status: checks.every((check) => check.ok) ? "ready_diagnostics_ok" : "ready_diagnostics_failed",
    service: "paygate-payment-hub",
    request_id: requestId,
    checks,
  };
}

function safeErrorCheck(name: string, error: unknown): Record<string, unknown> {
  const err = error as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
  const cause = err.cause as { code?: unknown; message?: unknown } | undefined;
  return {
    name,
    ok: false,
    error_name: typeof err.name === "string" ? err.name : undefined,
    error_code: typeof err.code === "string" ? err.code : typeof cause?.code === "string" ? cause.code : undefined,
    message: sanitizeErrorMessage(typeof err.message === "string" ? err.message : String(error)),
    cause_message: typeof cause?.message === "string" ? sanitizeErrorMessage(cause.message) : undefined,
  };
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/postgresql:\/\/[^\s]+/g, "postgresql://[redacted]").replace(/sk_(test|live)_[A-Za-z0-9]+/g, "sk_$1_[redacted]").replace(/whsec_[A-Za-z0-9]+/g, "whsec_[redacted]");
}

function checkRequired(name: string, value: string | undefined): unknown {
  return { name, ok: Boolean(value?.trim()), present: Boolean(value?.trim()), ...(hasMarkdown(value) ? { issue: "Value looks like a Markdown link. Paste plain text only." } : {}) };
}

function checkPlainUrl(name: string, value: string | undefined, required: boolean): unknown {
  if (!value?.trim()) return { name, ok: !required, present: false, ...(required ? { issue: "Missing required URL." } : {}) };
  if (hasMarkdown(value)) return { name, ok: false, present: true, issue: "Value looks like a Markdown link. Paste only the URL, without brackets or parentheses." };
  try {
    const parsed = new URL(value);
    return { name, ok: parsed.protocol === "https:", present: true, protocol: parsed.protocol, host: parsed.host, ...(parsed.protocol !== "https:" ? { issue: "URL must start with https://" } : {}) };
  } catch {
    return { name, ok: false, present: true, issue: "Value is not a valid URL." };
  }
}

function checkDatabaseUrl(value: string | undefined): unknown {
  if (!value?.trim()) return { name: "DATABASE_URL", ok: false, present: false, issue: "Missing PostgreSQL connection string." };
  if (hasMarkdown(value)) return { name: "DATABASE_URL", ok: false, present: true, issue: "Value looks like a Markdown link. Paste plain PostgreSQL URL only." };
  if (value.includes("\\@")) return { name: "DATABASE_URL", ok: false, present: true, issue: "Remove the backslash before @. Use ...%23@db..., not ...%23\\@db..." };
  if (value.includes("#")) return { name: "DATABASE_URL", ok: false, present: true, issue: "Password contains raw #. Encode it as %23." };
  try {
    const parsed = new URL(value);
    const okProtocol = parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
    const okHost = parsed.hostname === "db.apcqqyqpqyxbqlbqshog.supabase.co" || parsed.hostname.endsWith(".pooler.supabase.com");
    return {
      name: "DATABASE_URL",
      ok: okProtocol && okHost && Boolean(parsed.username) && Boolean(parsed.password),
      present: true,
      protocol: parsed.protocol,
      username: parsed.username,
      host: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname,
      sslmode: parsed.searchParams.get("sslmode"),
      ...(okProtocol ? {} : { issue: "DATABASE_URL must start with postgresql:// or postgres://" }),
      ...(!okHost ? { issue: "DATABASE_URL host does not look like the expected PayGate Supabase Postgres host/pooler." } : {}),
    };
  } catch {
    return { name: "DATABASE_URL", ok: false, present: true, issue: "Value is not a valid PostgreSQL URL. Check special character encoding in the password." };
  }
}

function liveReadinessSummary(accounts: string[], liveAccounts: string[]): unknown {
  const sandboxSet = new Set(accounts);
  const liveSet = new Set(liveAccounts.filter((account) => account !== "primary"));
  const sharedAccounts = [...liveSet].filter((account) => sandboxSet.has(account));
  const liveWebhookReady = [...liveSet].filter((account) => {
    const secretKey = process.env[liveEnvNameForProviderAccount(account, "SECRET_KEY")];
    const webhookSecret = process.env[liveEnvNameForProviderAccount(account, "WEBHOOK_SECRET")];
    return Boolean(secretKey?.startsWith("sk_live_") && webhookSecret?.startsWith("whsec_"));
  });
  return {
    name: "LIVE_OPERATOR_READINESS",
    ok: liveAccounts.length === 0 || liveWebhookReady.length === liveSet.size,
    sandbox_accounts: accounts,
    live_accounts: [...liveSet],
    shared_provider_accounts: sharedAccounts,
    live_webhook_ready_accounts: liveWebhookReady,
    live_checkout_enabled: liveWebhookReady.length === liveSet.size && liveSet.size > 0,
    live_portal_enabled: liveWebhookReady.length === liveSet.size && liveSet.size > 0,
    live_reconciliation_enabled: liveWebhookReady.length === liveSet.size && liveSet.size > 0,
    phase6_approval_required: true,
  };
}
function checkStripeAccounts(accounts: string[]): unknown {
  return {
    name: "STRIPE_ACCOUNTS",
    ok: accounts.includes("nhl_global_solution"),
    present: accounts.length > 0,
    accounts,
    ...(accounts.includes("nhl_global_solution") ? {} : { issue: "Expected nhl_global_solution in STRIPE_ACCOUNTS." }),
  };
}


function checkStripeLiveAccounts(accounts: string[]): unknown {
  return {
    name: "STRIPE_LIVE_ACCOUNTS",
    ok: accounts.every((account) => account !== "primary"),
    present: accounts.length > 0,
    accounts,
    ...(accounts.includes("primary") ? { issue: "Live provider account aliases must be company-scoped; do not use primary." } : {}),
  };
}

function checkNamedLiveAccount(account: string): unknown {
  return {
    name: `STRIPE_LIVE_ACCOUNT_ALIAS:${account}`,
    ok: account !== "primary",
    account,
    ...(account === "primary" ? { issue: "Live provider account alias must be company-scoped; do not use primary." } : {}),
  };
}
function checkSecret(name: string, value: string | undefined, expectedPrefix: string): unknown {
  const present = Boolean(value?.trim());
  return {
    name,
    ok: present && !hasMarkdown(value) && value!.startsWith(expectedPrefix),
    present,
    prefix_ok: present ? value!.startsWith(expectedPrefix) : false,
    ...(hasMarkdown(value) ? { issue: "Value looks like a Markdown link. Paste plain secret only." } : {}),
    ...(present && !value!.startsWith(expectedPrefix) ? { issue: `Secret should start with ${expectedPrefix}` } : {}),
  };
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function hasMarkdown(value: string | undefined): boolean {
  return Boolean(value && /^\[.+\]\(.+\)$/.test(value.trim()));
}

function envNameForProviderAccount(account: string, suffix: "SECRET_KEY" | "WEBHOOK_SECRET"): string {
  return `STRIPE_ACCOUNT_${normalizeProviderAccountEnvSegment(account)}_${suffix}`;
}

function liveEnvNameForProviderAccount(account: string, suffix: "SECRET_KEY" | "WEBHOOK_SECRET"): string {
  return `STRIPE_LIVE_ACCOUNT_${normalizeProviderAccountEnvSegment(account)}_${suffix}`;
}

function normalizeProviderAccountEnvSegment(account: string): string {
  return account.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}


function optionalQuery(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) || undefined;
}

function optionalEnvironment(url: URL): "test" | "live" | undefined {
  const value = url.searchParams.get("environment");
  if (!value) return undefined;
  if (value === "test" || value === "live") return value;
  return undefined;
}

function optionalLimit(url: URL): number | undefined {
  const value = url.searchParams.get("limit");
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(parsed, 1), 100);
}

function writeHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}
function writeJson(res: ServerResponse, status: number, body: unknown, cookies: string[] = []): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN?.trim() || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id,stripe-signature",
    "access-control-expose-headers": "x-request-id",
  ...(cookies.length ? { "set-cookie": cookies } : {}),
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}
const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PayGate Operator Console</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --ink:#0f172a; --muted:#64748b; --line:#dbe4f0; --soft:#f8fafc; --brand:#2563eb; --ok:#15803d; --warn:#a16207; --danger:#b91c1c; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: #f6f8fb; }
    main { max-width: 1260px; margin: 0 auto; padding: 18px 20px 48px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: -0.03em; }
    h2 { margin: 0 0 10px; font-size: 17px; letter-spacing: -0.02em; }
    h3 { margin: 0 0 8px; font-size: 14px; }
    p { margin: 6px 0; line-height: 1.45; }
    input, button, select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; }
    input, select { width: 100%; background: white; color: var(--ink); }
    button { cursor: pointer; background: var(--brand); color: white; border-color: var(--brand); font-weight: 800; min-height: 42px; }
    button.ghost { background: white; color: var(--ink); border-color: #cbd5e1; }
    section { background: white; border: 1px solid var(--line); border-radius: 18px; padding: 16px; margin: 14px 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05); }
    .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 14px; }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .safety { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .toolbar { display: grid; grid-template-columns: minmax(320px, 1.8fr) minmax(180px, .9fr) minmax(140px, .6fr) 130px; gap: 12px; align-items: end; }
    label { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: 12px; color: var(--muted); font-weight: 700; }
    .status-line { margin-top: 10px; color: var(--muted); font-size: 13px; }
    .console-layout { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 14px; align-items: start; }
    .sidebar { position: sticky; top: 14px; }
    .app-list { display: grid; gap: 8px; }
    .app-button { width: 100%; text-align: left; background: #fff; color: var(--ink); border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; min-height: unset; }
    .app-button:hover, .app-button.active { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
    .app-button-title { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-weight: 900; }
    .app-button-meta { color: var(--muted); font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
    .callout { border-radius: 18px; padding: 18px; display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
    .callout.ok { background: #ecfdf5; border: 1px solid #bbf7d0; }
    .callout.warn { background: #fffbeb; border: 1px solid #fde68a; }
    .callout.danger { background: #fef2f2; border: 1px solid #fecaca; }
    .callout-title { font-size: 20px; font-weight: 900; letter-spacing: -0.03em; }
    .metric-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .metric { background: var(--soft); border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; }
    .metric-value { font-size: 26px; font-weight: 900; letter-spacing: -0.04em; overflow-wrap: anywhere; }
    .metric-label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
    .wide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(315px, 1fr)); gap: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 13px; background: #fff; min-width: 0; }
    .card.soft { background: var(--soft); }
    .muted { color: var(--muted); }
    .small { font-size: 13px; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; background: #e2e8f0; color: #334155; font-size: 12px; font-weight: 800; margin: 2px 4px 2px 0; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.danger { background: #fee2e2; color: #991b1b; }
    .badge.info { background: #dbeafe; color: #1e40af; }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 7px; overflow-wrap: anywhere; }
    pre { white-space: pre-wrap; background: #0f172a; color: #e2e8f0; border-radius: 14px; padding: 14px; overflow: auto; max-height: 420px; }
    details summary { cursor: pointer; font-weight: 800; }
    .empty { padding: 14px; border: 1px dashed #cbd5e1; border-radius: 14px; color: var(--muted); background: var(--soft); }
    .section-kicker { color: var(--muted); font-size: 13px; margin-top: -5px; margin-bottom: 12px; }
    .record { display: grid; gap: 8px; }
    .record-row { display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 13px; }
    .record-label { color: var(--muted); font-weight: 700; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
    .tab { background: white; color: var(--ink); border: 1px solid #cbd5e1; min-height: 34px; padding: 7px 11px; }
    .tab.active { background: var(--ink); color: white; border-color: var(--ink); }
    .step { display: grid; grid-template-columns: 26px 1fr; gap: 10px; align-items: start; }
    .step-num { width: 24px; height: 24px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ink); color: white; font-size: 12px; font-weight: 900; }
    @media (max-width: 980px) { .toolbar, .metric-row, .callout, .console-layout { grid-template-columns: 1fr; } .sidebar { position: static; } .topbar { align-items: flex-start; flex-direction: column; } .safety { justify-content: flex-start; } }
  </style>
</head>
<body>
  <main>
    <header class="topbar">
      <div>
        <h1>PayGate Operator Console</h1>
        <p class="subtitle">Multi-app control room for provider routing, plan authority, entitlement evidence, and setup readiness.</p>
      </div>
      <div class="safety">
        <span class="badge info">Registry-owned commercial authority</span>
        <span class="badge info">Sandbox/live separated</span>
        <span class="badge warn">Refund deferred</span>
      </div>
    </header>

    <section>
      <div class="toolbar">
        <label>Operator login<input id="token" type="password" placeholder="Paste token once to sign in" autocomplete="off" /></label>
        <label>Search apps<input id="appSearch" placeholder="Search app name, ID, provider" /></label>
        <label>Environment<select id="environment"><option value="live">live</option><option value="test">test</option><option value="">all</option></select></label>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><button id="refresh">Load Console</button><button id="logout" class="ghost" type="button">Logout</button></div>
      </div>
      <p id="status" class="status-line">Not loaded. Sign in once; PayGate stores a secure HttpOnly admin session cookie.</p>
    </section>

    <section id="actionPanel" class="callout warn">
      <div>
        <div class="callout-title">Load PayGate status</div>
        <p>Sign in and load the console. Then choose an app from the app switcher.</p>
      </div>
      <span class="badge warn">waiting</span>
    </section>

    <section>
      <h2>Global Operational Snapshot</h2>
      <p class="section-kicker">All apps in the selected environment. Use the app switcher below to inspect one app.</p>
      <div id="dashboard" class="metric-row"><div class="empty">No data loaded.</div></div>
    </section>

    <div class="console-layout">
      <aside class="sidebar">
        <section>
          <h2>App Directory</h2>
          <p class="section-kicker">Select an app. No hardcoded app workflow.</p>
          <div class="tabs"><button id="allAppsTab" class="tab active">All apps</button><button id="selectedAppTab" class="tab">Selected app</button></div>
          <div id="appDirectory" class="app-list"><div class="empty">Load apps first.</div></div>
        </section>
      </aside>

      <div>
        <section>
          <h2 id="workspaceTitle">Selected App Workspace</h2>
          <p id="workspaceSubtitle" class="section-kicker">Choose an app from the directory to view plans, provider account, URLs, customers, webhooks, and reconciliation.</p>
          <div id="appWorkspace"><div class="empty">No app selected.</div></div>
        </section>

        <section>
          <h2>Customer Payment State</h2>
          <p class="section-kicker">Filtered to the selected app when an app is selected.</p>
          <div id="customers" class="wide-grid"><div class="empty">No data loaded.</div></div>
        </section>

        <section>
          <h2>Evidence Trail</h2>
          <p class="section-kicker">Checkout, webhook, and reconciliation evidence for selected scope.</p>
          <div class="wide-grid">
            <div><h3>Checkout Sessions</h3><div id="checkouts" class="record"><div class="empty">No data loaded.</div></div></div>
            <div><h3>Webhooks</h3><div id="webhooks" class="record"><div class="empty">No data loaded.</div></div></div>
            <div><h3>Reconciliation</h3><div id="reconciliation" class="record"><div class="empty">No data loaded.</div></div></div>
          </div>
        </section>

        <section>
          <h2>App Onboarding Checklist</h2>
          <p class="section-kicker">Use this before connecting app #2. This slice is guidance only; registry writes are not automated yet.</p>
          <div id="onboarding" class="grid"></div>
        </section>

        <section>
          <details>
            <summary>Support JSON</summary>
            <p class="muted small">For debugging only. Safe summary data; no secrets should appear here.</p>
            <pre id="raw">{}</pre>
          </details>
        </section>
      </div>
    </div>
  </main>
<script>
var $ = function (id) { return document.getElementById(id); };
var state = { summary: null, monitoring: null, selectedAppId: '', scope: 'all' };
function esc(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]; }); }
function badge(value, tone) { return '<span class="badge ' + esc(tone || '') + '">' + esc(value) + '</span>'; }
function row(label, value) { return '<div class="record-row"><div class="record-label">' + esc(label) + '</div><div>' + value + '</div></div>'; }
function card(title, rows) { return '<div class="card"><h3>' + esc(title) + '</h3><div class="record">' + rows.join('') + '</div></div>'; }
function metric(label, value, tone, detail) { return '<div class="metric"><div class="metric-label">' + esc(label) + '</div><div class="metric-value">' + esc(value) + '</div><div>' + (detail || badge(tone || 'ok', tone)) + '</div></div>'; }
function renderList(id, items, empty, render) { $(id).innerHTML = items && items.length ? items.map(render).join('') : '<div class="empty">' + esc(empty) + '</div>'; }
function statusTone(status) { return status === 'ok' || status === 'ready' || status === 'processed' || status === 'active' ? 'ok' : status === 'attention_required' || status === 'open' || status === 'warning' ? 'warn' : status ? 'danger' : ''; }
function money(plan) { return esc(plan.currency || '') + ' ' + ((Number(plan.amount_minor || 0) / 100).toFixed(2)); }
function currentParams() {
  var params = new URLSearchParams();
  if ($("environment").value) params.set("environment", $("environment").value);
  return params;
}
async function fetchJson(url) {
  var response = await fetch(url, { credentials: 'same-origin' });
  var body = await response.json().catch(function () { return {}; });
  return { ok: response.ok, status: response.status, body: body };
}
async function loginIfTokenPresent() {
  var token = $("token").value.trim();
  if (!token) return;
  var response = await fetch('/admin/session/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token }) });
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(body && body.error && body.error.message || 'Operator login failed');
  $("token").value = '';
}
async function logout() {
  await fetch('/admin/session/logout', { method: 'POST', credentials: 'same-origin' });
  state.summary = null;
  state.monitoring = null;
  state.selectedAppId = '';
  state.scope = 'all';
  $("status").textContent = 'Logged out.';
  $("dashboard").innerHTML = '<div class="empty">No data loaded.</div>';
  $("appDirectory").innerHTML = '<div class="empty">Sign in and load apps first.</div>';
  $("appWorkspace").innerHTML = '<div class="empty">No app selected.</div>';
  $("customers").innerHTML = '<div class="empty">No data loaded.</div>';
  $("checkouts").innerHTML = '<div class="empty">No data loaded.</div>';
  $("webhooks").innerHTML = '<div class="empty">No data loaded.</div>';
  $("reconciliation").innerHTML = '<div class="empty">No data loaded.</div>';
}function collectProviderAccounts(apps) {
  var set = {};
  (apps || []).forEach(function (app) { if (app.provider_account) set[(app.provider_id || 'provider') + ':' + app.provider_account] = true; });
  return Object.keys(set).sort();
}
function filteredApps() {
  var search = $("appSearch").value.trim().toLowerCase();
  var apps = state.summary && state.summary.apps || [];
  if (!search) return apps;
  return apps.filter(function (app) { return [app.app_id, app.name, app.provider_id, app.provider_account].join(' ').toLowerCase().includes(search); });
}
function selectedApp() {
  var apps = state.summary && state.summary.apps || [];
  return apps.find(function (app) { return app.app_id === state.selectedAppId; }) || null;
}
function recordsForSelected(name) {
  var rows = state.summary && state.summary[name] || [];
  if (state.scope !== 'selected' || !state.selectedAppId) return rows;
  return rows.filter(function (row) { return row.app_id === state.selectedAppId; });
}
function renderActionPanel(summary, monitoring) {
  var alerts = monitoring.alerts || [];
  var apps = summary.apps || [];
  var critical = alerts.filter(function (a) { return a.severity === 'critical'; });
  var panel = $("actionPanel");
  var tone = critical.length ? 'danger' : alerts.length ? 'warn' : 'ok';
  var title = critical.length ? 'Stop: critical payment issue' : alerts.length ? 'Review warnings before app setup' : 'PayGate is healthy for this environment';
  var body = critical.length ? 'Clear critical monitoring or webhook issues before connecting another app.' : alerts.length ? 'Warnings are present. Select an app and inspect customer/reconciliation evidence before onboarding.' : 'Next safe step: continue with app onboarding wizard UI. Refund remains deferred.';
  if (!apps.length) { tone = 'warn'; title = 'No apps configured'; body = 'PayGate needs at least one registry app before setup can continue.'; }
  panel.className = 'callout ' + tone;
  panel.innerHTML = '<div><div class="callout-title">' + esc(title) + '</div><p>' + esc(body) + '</p>' + (alerts.length ? '<p>' + alerts.map(function (a) { return badge(a.severity + ':' + a.code, a.severity === 'critical' ? 'danger' : 'warn'); }).join('') + '</p>' : '') + '</div>' + badge(tone === 'ok' ? 'ok' : 'needs review', tone);
}
function renderDashboard(summary, monitoring) {
  var apps = summary.apps || [];
  var customers = summary.customers || [];
  var webhooks = summary.webhooks || [];
  var reconciliations = summary.reconciliation_runs || [];
  var providerAccounts = collectProviderAccounts(apps);
  var webhookChecks = monitoring.checks && monitoring.checks.webhook_inbox || {};
  var reconciliationChecks = monitoring.checks && monitoring.checks.reconciliation || {};
  $("dashboard").innerHTML = [
    metric('Gateway status', monitoring.status || 'unknown', statusTone(monitoring.status)),
    metric('Apps', apps.length, 'info', providerAccounts.map(function (p) { return badge(p, 'info'); }).join('') || badge('no provider', 'warn')),
    metric('Customers', customers.length, 'info', badge('selected environment', 'info')),
    metric('Webhooks', webhooks.length, (webhookChecks.deadLetter || webhookChecks.retryable) ? 'danger' : 'ok', '<span class="small muted">pending/retry/dead</span><br /><code>' + esc((webhookChecks.pending || 0) + '/' + (webhookChecks.retryable || 0) + '/' + (webhookChecks.deadLetter || 0)) + '</code>'),
    metric('Reconciliation', reconciliations.length, (reconciliationChecks.failed || 0) > 0 ? 'danger' : (reconciliationChecks.noProviderCustomer || reconciliationChecks.noProviderSubscription) ? 'warn' : 'ok', '<span class="small muted">failed/no customer/no subscription</span><br /><code>' + esc((reconciliationChecks.failed || 0) + '/' + (reconciliationChecks.noProviderCustomer || 0) + '/' + (reconciliationChecks.noProviderSubscription || 0)) + '</code>')
  ].join('');
  renderActionPanel(summary, monitoring);
}
function renderAppDirectory() {
  var apps = filteredApps();
  renderList('appDirectory', apps, 'No apps match this search.', function (app) {
    var planCount = (app.plans || []).length;
    var selected = app.app_id === state.selectedAppId ? ' active' : '';
    return '<button class="app-button' + selected + '" data-app-id="' + esc(app.app_id) + '"><div class="app-button-title"><span>' + esc(app.name || app.app_id) + '</span>' + badge(planCount + ' plan' + (planCount === 1 ? '' : 's'), 'info') + '</div><div class="app-button-meta"><code>' + esc(app.app_id) + '</code><br />' + esc((app.provider_id || 'provider') + ':' + (app.provider_account || 'unknown')) + '</div></button>';
  });
  Array.prototype.forEach.call(document.querySelectorAll('.app-button'), function (button) { button.addEventListener('click', function () { state.selectedAppId = button.getAttribute('data-app-id') || ''; state.scope = 'selected'; renderAll(); }); });
}
function renderWorkspace() {
  var app = selectedApp();
  $("allAppsTab").className = 'tab ' + (state.scope === 'all' ? 'active' : '');
  $("selectedAppTab").className = 'tab ' + (state.scope === 'selected' ? 'active' : '');
  if (!app) {
    $("workspaceTitle").textContent = 'Selected App Workspace';
    $("workspaceSubtitle").textContent = 'Choose an app from the directory to view and verify its setup.';
    $("appWorkspace").innerHTML = '<div class="empty">No app selected. Choose an app from the left directory.</div>';
    return;
  }
  $("workspaceTitle").textContent = app.name + ' Workspace';
  $("workspaceSubtitle").textContent = app.app_id + ' uses ' + app.provider_id + ':' + app.provider_account + '. All values shown here are PayGate-owned configuration.';
  var plans = (app.plans || []).map(function (plan) { return '<div class="card soft"><h3>' + esc(plan.plan_key) + ' ' + badge(plan.status, statusTone(plan.status)) + '</h3><p>' + esc(plan.name) + '</p><p><strong>' + money(plan) + '</strong> · ' + esc(plan.mode) + '</p><p>' + badge(plan.provider_lookup_configured ? 'sandbox lookup ok' : 'sandbox lookup missing', plan.provider_lookup_configured ? 'ok' : 'danger') + badge(plan.live_provider_lookup_configured ? 'live lookup ok' : 'live lookup missing', plan.live_provider_lookup_configured ? 'ok' : 'warn') + '</p><p class="small muted">Entitlements: ' + esc((plan.entitlements || []).join(', ') || 'none') + '</p></div>'; }).join('');
  $("appWorkspace").innerHTML = '<div class="wide-grid">' +
    card('App authority', [row('App ID', '<code>' + esc(app.app_id) + '</code>'), row('Provider', '<code>' + esc(app.provider_id) + ':' + esc(app.provider_account) + '</code>'), row('Secrets', 'Hidden server-side'), row('Edit mode', badge('view-only in Track 1C', 'warn'))]) +
    card('URLs', [row('Test', esc(app.origins && app.origins.test || 'missing')), row('Live', esc(app.origins && app.origins.live || 'missing')), row('Return URLs', 'Registry allowlist only; callers cannot pass arbitrary URLs.')]) +
    card('Setup actions', [row('Current safe action', 'Review this app, then use Track 1D draft wizard for changes.'), row('Danger actions', 'Live payments/refunds and direct registry mutation remain gated.')]) +
    '</div><h3 style="margin-top:14px">Plans</h3><div class="grid">' + (plans || '<div class="empty">No plans configured.</div>') + '</div>';
}
function renderProviderAccounts() {
  var apps = state.scope === 'selected' && selectedApp() ? [selectedApp()] : filteredApps();
  var rows = {};
  (apps || []).forEach(function (app) {
    var key = (app.provider_id || 'provider') + ':' + (app.provider_account || 'unknown');
    if (!rows[key]) rows[key] = { key: key, apps: [], plans: 0, liveReady: 0, sandboxReady: 0 };
    rows[key].apps.push(app.app_id);
    (app.plans || []).forEach(function (plan) { rows[key].plans += 1; if (plan.provider_lookup_configured) rows[key].sandboxReady += 1; if (plan.live_provider_lookup_configured) rows[key].liveReady += 1; });
  });
  return Object.values(rows).map(function (item) { return card(item.key, [row('Linked apps', item.apps.map(function (app) { return badge(app, 'info'); }).join(' ')), row('Lookup readiness', badge('sandbox ' + item.sandboxReady + '/' + item.plans, item.sandboxReady === item.plans ? 'ok' : 'warn') + badge('live ' + item.liveReady + '/' + item.plans, item.liveReady === item.plans ? 'ok' : 'warn')), row('Secrets', 'Hidden server-side')]); }).join('') || '<div class="empty">No provider accounts.</div>';
}
function renderCustomers(customers) {
  renderList("customers", customers || [], "No customers.", function (c) { return card((c.app_id || 'app') + ' / ' + (c.user_ref || 'user'), [row('PayGate state', badge(c.subscription && c.subscription.state || 'none', statusTone(c.subscription && c.subscription.state)) + ' ' + esc(c.subscription && c.subscription.plan_key || '')), row('Provider customer', ((c.provider_customers || []).map(function (pc) { return '<code>' + esc(pc.provider_account + ':' + pc.environment + ':' + pc.provider_customer_ref) + '</code>'; }).join('<br />')) || 'none'), row('Entitlements', ((c.entitlements || []).map(function (e) { return badge(e.key + '=' + e.state, statusTone(e.state)); }).join(' ')) || 'none')]); });
}
function renderCheckouts(sessions) { renderList("checkouts", sessions || [], "No checkout sessions.", function (s) { return card(s.provider_checkout_session_ref || 'session', [row('App/user', esc(s.app_id) + ' / ' + esc(s.user_ref)), row('Provider', '<code>' + esc(s.provider_id) + ':' + esc(s.provider_account) + ':' + esc(s.environment) + '</code>'), row('Plan/status', badge(s.plan_key, 'info') + badge(s.status, statusTone(s.status))), row('Created', esc(s.created_at))]); }); }
function renderWebhooks(webhooks) { renderList("webhooks", webhooks || [], "No webhooks.", function (w) { return card(w.provider_event_id || 'event', [row('Type/status', '<code>' + esc(w.event_type) + '</code> ' + badge(w.status, statusTone(w.status))), row('Provider', '<code>' + esc(w.provider_id) + ':' + esc(w.provider_account) + ':' + esc(w.environment) + '</code>'), row('App/user', esc(w.app_id || 'unknown') + ' / ' + esc(w.user_ref || 'unknown')), row('Processed', esc(w.processed_at || 'not yet'))]); }); }
function renderReconciliation(runs) { renderList("reconciliation", runs || [], "No reconciliation runs.", function (r) { var note = r.status === 'no_provider_subscription' ? 'Expected for one-time payment plans; PayGate state remains the authority.' : esc(r.classification || 'none'); return card(r.id || 'run', [row('Status', badge(r.status || 'unknown', statusTone(r.status))), row('Note', note), row('Provider', '<code>' + esc(r.provider_id) + ':' + esc(r.provider_account) + ':' + esc(r.environment) + '</code>'), row('App/user', esc(r.app_id || '') + ' / ' + esc(r.user_ref || ''))]); }); }
function renderOnboarding() {
  var steps = ['Add New App starts as draft, not live.', 'Confirm app owner, repository, production URL, and sandbox URL.', 'Confirm user identity and app auth boundary.', 'Choose company-scoped provider account alias.', 'Define PayGate-owned plans, lookup keys, and entitlements.', 'Configure Stripe products/prices and webhook endpoint.', 'Run registry validation and provider isolation tests.', 'Complete sandbox checkout, webhook, entitlement, portal, and reconciliation proof.', 'Record evidence before live-mode approval.'];
  $("onboarding").innerHTML = steps.map(function (step, index) { return '<div class="card soft"><div class="step"><span class="step-num">' + (index + 1) + '</span><p>' + esc(step) + '</p></div></div>'; }).join('');
}
function renderAll() {
  if (!state.summary || !state.monitoring) return;
  renderDashboard(state.summary, state.monitoring);
  renderAppDirectory();
  renderWorkspace();
  $("providerAccounts").innerHTML = renderProviderAccounts();
  renderCustomers(recordsForSelected('customers'));
  renderCheckouts(recordsForSelected('checkout_sessions'));
  renderWebhooks(recordsForSelected('webhooks'));
  renderReconciliation(recordsForSelected('reconciliation_runs'));
  renderOnboarding();
}
async function refresh() {
  await loginIfTokenPresent();
  var params = currentParams();
  $("status").textContent = 'Loading all apps...';
  var monitoringResult = await fetchJson('/admin/monitoring?' + params.toString());
  var summaryResult = await fetchJson('/admin/summary?' + params.toString());
  $("raw").textContent = JSON.stringify({ monitoring: monitoringResult.body, summary: summaryResult.body }, null, 2);
  if (!summaryResult.ok) { $("status").textContent = summaryResult.status + ': ' + (summaryResult.body && summaryResult.body.error && summaryResult.body.error.code || 'error'); return; }
  state.summary = summaryResult.body || {};
  state.monitoring = monitoringResult.ok ? monitoringResult.body : { status: 'attention_required', alerts: [{ severity: 'warning', code: 'MONITORING_UNAVAILABLE' }], checks: {} };
  var apps = state.summary.apps || [];
  if (!state.selectedAppId && apps.length) state.selectedAppId = apps[0].app_id;
  $("status").textContent = 'Loaded ' + state.summary.generated_at + ' · apps=' + apps.length + ' · env=' + ($("environment").value || 'all');
  renderAll();
}renderOnboarding();
$("refresh").addEventListener("click", function () { refresh().catch(function (error) { $("status").textContent = error.message; }); });
$("logout").addEventListener("click", function () { logout().catch(function (error) { $("status").textContent = error.message; }); });
$("appSearch").addEventListener("input", renderAppDirectory);
$("allAppsTab").addEventListener("click", function () { state.scope = 'all'; renderAll(); });
$("selectedAppTab").addEventListener("click", function () { state.scope = 'selected'; renderAll(); });
</script>
</body>
</html>`;