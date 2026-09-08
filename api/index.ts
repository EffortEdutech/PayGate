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
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --bg:#f5f7fb; --panel:#ffffff; --ink:#111827; --muted:#667085; --line:#e4e7ec; --brand:#155eef; --brand-soft:#eff4ff; --ok:#067647; --warn:#b54708; --danger:#b42318; --soft:#f9fafb; --shadow:0 16px 44px rgba(16,24,40,.08); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); }
    button, input, select { font: inherit; }
    button { border: 0; border-radius: 12px; cursor: pointer; font-weight: 800; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    input, select { width: 100%; border: 1px solid #d0d5dd; border-radius: 12px; padding: 11px 12px; background: white; color: var(--ink); }
    label { display: grid; gap: 7px; color: var(--muted); font-size: 12px; font-weight: 800; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 26px; letter-spacing: -.035em; margin-bottom: 8px; }
    h2 { font-size: 20px; letter-spacing: -.025em; margin-bottom: 8px; }
    h3 { font-size: 14px; margin-bottom: 8px; }
    p { color: var(--muted); line-height: 1.55; }
    code { background: #eef2f6; border: 1px solid #d9e0ea; border-radius: 8px; padding: 2px 6px; }
    .hidden { display: none !important; }
    .login-screen { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .login-card { width: min(460px, 100%); background: var(--panel); border: 1px solid var(--line); border-radius: 24px; padding: 26px; box-shadow: var(--shadow); }
    .login-badge { display: inline-flex; border: 1px solid #b2ccff; color: #1849a9; background: var(--brand-soft); border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 900; margin-bottom: 14px; }
    .primary { background: var(--brand); color: white; padding: 11px 14px; min-height: 44px; }
    .secondary { background: white; color: var(--ink); border: 1px solid #d0d5dd; padding: 10px 12px; min-height: 42px; }
    .danger { background: #fff1f3; color: var(--danger); border: 1px solid #fecdd6; padding: 10px 12px; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 282px minmax(0, 1fr); }
    .sidebar { background: #0b1220; color: white; padding: 18px; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 0; height: 100vh; }
    .brand { display: grid; gap: 4px; padding: 4px 2px 8px; }
    .brand-title { font-size: 20px; font-weight: 950; letter-spacing: -.03em; }
    .brand-subtitle { color: #98a2b3; font-size: 12px; line-height: 1.4; }
    .nav { display: grid; gap: 7px; }
    .nav button { width: 100%; text-align: left; background: transparent; color: #d0d5dd; padding: 11px 12px; border-radius: 12px; min-height: 42px; }
    .nav button:hover, .nav button.active { background: #1d2939; color: white; }
    .nav button.future { color: #98a2b3; border: 1px dashed #475467; }
    .sidebar-footer { margin-top: auto; border-top: 1px solid #344054; padding-top: 14px; display: grid; gap: 10px; }
    .operator-pill { background: #101828; border: 1px solid #344054; border-radius: 16px; padding: 12px; }
    .operator-pill strong { display: block; font-size: 13px; }
    .operator-pill span { color: #98a2b3; font-size: 12px; }
    .content { min-width: 0; padding: 22px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
    .topbar-actions { display: flex; align-items: end; gap: 10px; min-width: 360px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 18px; box-shadow: 0 8px 28px rgba(16,24,40,.04); margin-bottom: 14px; }
    .view-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .kpi { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 15px; }
    .kpi-label { color: var(--muted); font-size: 12px; font-weight: 850; }
    .kpi-value { font-size: 24px; font-weight: 950; margin-top: 5px; letter-spacing: -.025em; }
    .kpi-note { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 900; border: 1px solid #d0d5dd; background: white; color: var(--muted); }
    .status.ok { color: var(--ok); border-color: #abefc6; background: #ecfdf3; }
    .status.warn { color: var(--warn); border-color: #fedf89; background: #fffaeb; }
    .status.danger { color: var(--danger); border-color: #fecdca; background: #fef3f2; }
    .banner { border-radius: 18px; padding: 15px; border: 1px solid #fedf89; background: #fffaeb; color: #93370d; margin-bottom: 14px; }
    .banner.ok { border-color: #abefc6; background: #ecfdf3; color: #05603a; }
    .two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
    .three-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .app-card { text-align: left; background: white; color: var(--ink); border: 1px solid var(--line); border-radius: 18px; padding: 15px; min-height: 150px; }
    .app-card:hover, .app-card.active { border-color: #84adff; box-shadow: 0 0 0 4px var(--brand-soft); }
    .app-card-title { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; font-weight:950; margin-bottom:8px; }
    .list { display: grid; gap: 9px; }
    .row { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; }
    .row-title { font-weight: 900; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; }
    .meta { color: var(--muted); font-size: 12px; margin-top: 5px; line-height: 1.45; overflow-wrap: anywhere; }
    .toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) 170px 130px; gap: 10px; align-items:end; }
    .empty { border: 1px dashed #cbd5e1; border-radius: 16px; padding: 18px; text-align: center; color: var(--muted); background: #fff; }
    .debug { white-space: pre-wrap; overflow: auto; max-height: 520px; background: #0b1220; color: #d0d5dd; border-radius: 16px; padding: 14px; font-size: 12px; }
    .workspace-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
    .workspace-tab { background: white; color: var(--ink); border: 1px solid #d0d5dd; padding: 9px 12px; min-height: 38px; }
    .workspace-tab.active { background: var(--brand); color: white; border-color: var(--brand); }
    .workspace-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .identity-help { margin-top: 14px; display: grid; gap: 5px; border: 1px solid #b2ccff; background: var(--brand-soft); border-radius: 16px; padding: 12px; color: #1849a9; }
    .identity-help span { color: #194185; font-size: 13px; line-height: 1.45; }
    @media (max-width: 980px) { .shell { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; } .content { padding: 14px; } .topbar, .view-header { flex-direction: column; align-items: stretch; } .topbar-actions, .kpi-grid, .two-col, .three-col, .toolbar { grid-template-columns: 1fr; display: grid; min-width: 0; } }
  </style>
</head>
<body>
  <main id="loginScreen" class="login-screen">
    <section class="login-card">
      <div class="login-badge">Protected operator area</div>
      <h1>PayGate Operator Login</h1>
      <p>Sign in to the PayGate operator console. This credential belongs to PayGate, not AIntern, not Stripe, and not an app user account.</p>
      <form id="loginForm">
        <label>PayGate operator access token
          <input id="operatorToken" type="password" autocomplete="current-password" placeholder="Paste operator token" />
        </label>
        <div style="height:12px"></div>
        <button class="primary" type="submit" style="width:100%">Load Console</button>
      </form>
      <div class="identity-help"><strong>What is this?</strong><span>Temporary PayGate admin access from <code>OPERATOR_DIAGNOSTICS_TOKEN</code> in Vercel. After login, PayGate creates a secure admin session cookie.</span></div><p id="loginStatus" class="meta">Future target: named operator login with roles; this token remains the emergency bootstrap credential.</p>
    </section>
  </main>

  <section id="appShell" class="shell hidden" aria-label="PayGate Operator Console">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-title">PayGate</div>
        <div class="brand-subtitle">Operator Console<br/>Dashboard + app workspaces</div>
      </div>
      <nav class="nav" aria-label="Console navigation">
        <button data-view="dashboard" class="active">Dashboard</button>
        <button data-view="apps">Apps Directory</button>
        <button data-view="workspace">App Workspace</button>
        <button data-view="providers">Provider Accounts</button>
        <button data-view="webhooks">Webhooks</button>
        <button data-view="reconciliation">Reconciliation</button>
        <button data-view="settings">Settings</button>
        <button data-view="support">Support / Debug</button>
        <button class="future" disabled>Add App - planned</button>
      </nav>
      <div class="sidebar-footer">
        <label>Environment
          <select id="environmentFilter">
            <option value="live">live</option>
            <option value="test">test</option>
            <option value="all">all</option>
          </select>
        </label>
        <div class="operator-pill"><strong>Operator session active</strong><span>Read-only shell. Logout clears the browser session.</span></div>
        <button id="logoutBtn" class="danger" type="button">Logout</button>
      </div>
    </aside>

    <main class="content">
      <div class="topbar">
        <div>
          <h1>PayGate Operator Console</h1>
          <p id="pageSubtitle">Monitor gateway health first, then open an app workspace when action is needed.</p>
        </div>
        <div class="topbar-actions">
          <label>Search apps
            <input id="appSearch" placeholder="Search app name, id, provider" />
          </label>
          <button id="refreshBtn" class="primary" type="button">Refresh</button>
        </div>
      </div>

      <div id="loadState" class="panel">Loading PayGate operator workspace...</div>

      <div id="view-dashboard" class="view"></div>
      <div id="view-apps" class="view hidden"></div>
      <div id="view-workspace" class="view hidden"></div>
      <div id="view-providers" class="view hidden"></div>
      <div id="view-webhooks" class="view hidden"></div>
      <div id="view-reconciliation" class="view hidden"></div>
      <div id="view-settings" class="view hidden"></div>
      <div id="view-support" class="view hidden"></div>
    </main>
  </section>

<script>
(function(){
  var state = { view: 'dashboard', environment: 'live', summary: null, monitoring: null, selectedAppId: '', loadedAt: '', error: null };
  function el(id){ return document.getElementById(id); }
  function esc(value){ return String(value == null ? '' : value).replace(/[&<>\"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]; }); }
  function fmtDate(value){ if(!value) return 'not recorded'; try { return new Date(value).toLocaleString(); } catch(e) { return value; } }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function money(plan){ return (plan.currency || '').toUpperCase() + ' ' + ((Number(plan.amount_minor || 0) / 100).toFixed(2)); }
  function apps(){ return arr(state.summary && state.summary.apps); }
  function customers(){ return arr(state.summary && state.summary.customers); }
  function sessions(){ return arr(state.summary && state.summary.checkout_sessions); }
  function webhooks(){ return arr(state.summary && state.summary.webhooks); }
  function runs(){ return arr(state.summary && state.summary.reconciliation_runs); }
  function selectedApp(){ return apps().find(function(app){ return app.app_id === state.selectedAppId; }) || apps()[0]; }
  function selectedAppId(){ var app = selectedApp(); return app ? app.app_id : ''; }
  function filteredApps(){
    var term = el('appSearch').value.trim().toLowerCase();
    if(!term) return apps();
    return apps().filter(function(app){ return [app.app_id, app.name, app.provider_id, app.provider_account].join(' ').toLowerCase().indexOf(term) >= 0; });
  }
  function statusClass(value){ if(value === 'ok' || value === 'ready' || value === 'processed' || value === 'active') return 'ok'; if(value === 'failed' || value === 'dead' || value === 'critical') return 'danger'; return 'warn'; }
  function setStatus(text){ el('loadState').textContent = text; el('loadState').classList.remove('hidden'); }
  function hideStatus(){ el('loadState').classList.add('hidden'); }
  async function jsonFetch(url, options){
    var response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
    var body = await response.json().catch(function(){ return {}; });
    if(!response.ok){ var err = new Error((body.error && body.error.message) || ('HTTP ' + response.status)); err.status = response.status; err.body = body; throw err; }
    return body;
  }
  async function checkSession(){
    try { await jsonFetch('/admin/session'); showShell(); await refresh(); }
    catch(e) { showLogin(); }
  }
  function showLogin(){ el('loginScreen').classList.remove('hidden'); el('appShell').classList.add('hidden'); }
  function showShell(){ el('loginScreen').classList.add('hidden'); el('appShell').classList.remove('hidden'); }
  async function login(token){
    el('loginStatus').textContent = 'Checking operator session...';
    await jsonFetch('/admin/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token }) });
    el('operatorToken').value = '';
    showShell();
    await refresh();
  }
  async function logout(){ await jsonFetch('/admin/session/logout', { method: 'POST' }).catch(function(){}); state.summary = null; state.monitoring = null; showLogin(); }
  async function refresh(){
    try {
      state.error = null;
      state.environment = el('environmentFilter').value;
      setStatus('Loading ' + state.environment + ' gateway snapshot...');
      var envParam = state.environment === 'all' ? '' : ('?environment=' + encodeURIComponent(state.environment));
      var joiner = envParam ? '&' : '?';
      var summaryUrl = '/admin/summary' + envParam;
      var monitoringUrl = '/admin/monitoring' + envParam + joiner + 'app_id=' + encodeURIComponent(state.selectedAppId || '');
      var result = await Promise.all([jsonFetch(summaryUrl), jsonFetch(monitoringUrl)]);
      state.summary = result[0];
      state.monitoring = result[1];
      state.loadedAt = new Date().toISOString();
      if(!state.selectedAppId && apps()[0]) state.selectedAppId = apps()[0].app_id;
      hideStatus();
      render();
    } catch(e) {
      state.error = e;
      setStatus('Unable to load console: ' + (e.body && e.body.error ? e.body.error.code + ' - ' + e.body.error.message : e.message));
    }
  }
  function switchView(view){
    state.view = view;
    document.querySelectorAll('.nav button[data-view]').forEach(function(btn){ btn.classList.toggle('active', btn.dataset.view === view); });
    document.querySelectorAll('.view').forEach(function(node){ node.classList.add('hidden'); });
    el('view-' + view).classList.remove('hidden');
    var subtitles = { dashboard:'Monitor gateway health first, then open an app workspace when action is needed.', apps:'Find and select the app you want to operate.', workspace:'Work on one app at a time: plans, customers, webhooks, entitlements, evidence.', providers:'Check which Stripe accounts serve which apps without exposing secrets.', webhooks:'Review recent provider events and processing status.', reconciliation:'Review reconciliation outcomes and attention items.', settings:'Review safe operating boundaries and current environment.', support:'Raw safe JSON for troubleshooting only.' };
    el('pageSubtitle').textContent = subtitles[view] || '';
    render();
  }
  function render(){ if(!state.summary) return; renderDashboard(); renderApps(); renderWorkspace(); renderProviders(); renderWebhooks(); renderReconciliation(); renderSettings(); renderSupport(); }
  function renderDashboard(){
    var mon = state.monitoring || {};
    var alerts = arr(mon.alerts);
    var status = mon.status || 'unknown';
    var selected = selectedAppId();
    var webhookCounts = mon.checks && mon.checks.webhook_inbox ? mon.checks.webhook_inbox : {};
    var recCounts = mon.checks && mon.checks.reconciliation ? mon.checks.reconciliation : {};
    el('view-dashboard').innerHTML =
      '<div class="view-header"><div><h2>Dashboard</h2><p>Gateway-wide health and action queue. This page answers: is PayGate safe right now?</p></div><span class="status ' + statusClass(status) + '">' + esc(status) + '</span></div>' +
      '<div class="banner ' + (alerts.length ? '' : 'ok') + '">' + (alerts.length ? '<strong>Attention required.</strong> ' + esc(alerts.map(function(a){ return a.severity + ':' + a.code; }).join(', ')) : '<strong>All clear.</strong> No monitoring alerts for this filter.') + '</div>' +
      '<div class="kpi-grid">' +
        kpi('Apps registered', apps().length, 'Current filtered registry view') +
        kpi('Customers', customers().length, 'Customers in current evidence window') +
        kpi('Recent webhooks', webhooks().length, 'Provider events loaded') +
        kpi('Reconciliation runs', runs().length, 'Recent reconciliation evidence') +
      '</div>' +
      '<div class="two-col" style="margin-top:14px">' +
        panel('Attention Queue', alerts.length ? alerts.map(function(a){ return row(a.code, a.message || a.severity, a.severity); }).join('') : empty('No operator action is currently required.')) +
        panel('Recent Activity', recentActivity()) +
      '</div>' +
      '<div class="panel"><h3>Current app focus</h3><p><strong>' + esc(selected || 'none') + '</strong> is selected for workspace actions. Use Apps Directory to change app.</p><button class="secondary" type="button" onclick="window.paygateSwitchView(\'workspace\')">Open App Workspace</button></div>';
  }
  function renderApps(){
    var cards = filteredApps().map(function(app){
      var planCount = arr(app.plans).length;
      return '<button class="app-card ' + (app.app_id === state.selectedAppId ? 'active' : '') + '" type="button" data-app="' + esc(app.app_id) + '"><div class="app-card-title"><span>' + esc(app.name || app.app_id) + '</span><span class="status ' + statusClass('active') + '">' + esc(app.app_id) + '</span></div><p>' + esc(app.provider_id || 'provider') + ':' + esc(app.provider_account || 'account') + '</p><div class="meta">Plans: ' + planCount + '<br/>Test origin: ' + esc(app.origins && app.origins.test ? app.origins.test : 'not set') + '<br/>Live origin: ' + esc(app.origins && app.origins.live ? app.origins.live : 'not set') + '</div></button>';
    }).join('');
    el('view-apps').innerHTML = '<div class="view-header"><div><h2>Apps Directory</h2><p>Select one app, then work inside its workspace. This is where multi-app operation begins.</p></div><button class="secondary" disabled>Add New App - planned</button></div><div class="app-grid">' + (cards || empty('No apps match the current search.')) + '</div>';
    document.querySelectorAll('[data-app]').forEach(function(btn){ btn.addEventListener('click', function(){ state.selectedAppId = btn.getAttribute('data-app') || ''; switchView('workspace'); }); });
  }
  function renderWorkspace(){
    var app = selectedApp();
    if(!app){ el('view-workspace').innerHTML = empty('No app selected. Open Apps Directory first.'); return; }
    var appCustomers = customers().filter(function(c){ return c.app_id === app.app_id; });
    var appWebhooks = webhooks().filter(function(w){ return w.app_id === app.app_id; });
    var appRuns = runs().filter(function(r){ return r.app_id === app.app_id; });
    var appSessions = sessions().filter(function(s){ return s.app_id === app.app_id; });
    var tab = state.workspaceTab || 'overview';
    var tabs = ['overview','plans','urls','customers','webhooks','reconciliation','evidence'];
    var tabLabels = { overview:'Overview', plans:'Plans', urls:'URLs', customers:'Customers', webhooks:'Webhooks', reconciliation:'Reconciliation', evidence:'Evidence' };
    var tabButtons = tabs.map(function(name){ return '<button class="workspace-tab ' + (tab === name ? 'active' : '') + '" type="button" data-workspace-tab="' + name + '">' + tabLabels[name] + '</button>'; }).join('');
    el('view-workspace').innerHTML =
      '<div class="view-header"><div><h2>App Workspace: ' + esc(app.name || app.app_id) + '</h2><p>One app, one operating surface. Pick a tab instead of scanning one long page.</p></div><span class="status ok">' + esc(app.app_id) + '</span></div>' +
      '<div class="workspace-summary">' +
        kpi('Plans', arr(app.plans).length, 'PayGate-owned catalog') +
        kpi('Customers', appCustomers.length, 'In current filter') +
        kpi('Webhooks', appWebhooks.length, 'Verified provider events') +
        kpi('Reconciliation', appRuns.length, 'Explicit evidence runs') +
      '</div>' +
      '<div class="workspace-tabs">' + tabButtons + '</div>' +
      '<div>' + workspaceTabContent(tab, app, appCustomers, appWebhooks, appRuns, appSessions) + '</div>';
    document.querySelectorAll('[data-workspace-tab]').forEach(function(btn){ btn.addEventListener('click', function(){ state.workspaceTab = btn.getAttribute('data-workspace-tab') || 'overview'; renderWorkspace(); }); });
  }
  function workspaceTabContent(tab, app, appCustomers, appWebhooks, appRuns, appSessions){
    if(tab === 'plans') return panel('Plans and Prices', arr(app.plans).map(function(p){ return row(p.name || p.plan_key, money(p) + ' - ' + esc(p.mode || '') + ' - ' + esc(p.status || ''), 'Plan key: ' + p.plan_key + ' - lookup configured: ' + Boolean(p.provider_lookup_configured) + ' - entitlements: ' + arr(p.entitlements).join(', ')); }).join('') || empty('No plans configured.'));
    if(tab === 'urls') return '<div class="two-col">' + panel('Return Origins', '<p><strong>Test:</strong> ' + esc(app.origins && app.origins.test ? app.origins.test : 'not set') + '</p><p><strong>Live:</strong> ' + esc(app.origins && app.origins.live ? app.origins.live : 'not set') + '</p>') + panel('Boundary Rule', '<p>Apps may request a return context only. PayGate resolves the final return URL from registry allowlists.</p><p>Browser redirects never grant entitlements.</p>') + '</div>';
    if(tab === 'customers') return panel('Customers and Entitlements', appCustomers.map(customerCard).join('') || empty('No customers in this filter.'));
    if(tab === 'webhooks') return panel('Webhook Evidence', appWebhooks.map(function(w){ return row(w.event_type, w.provider_event_id, w.status + ' - ' + w.provider_account + ' - ' + fmtDate(w.received_at)); }).join('') || empty('No webhook evidence for this app.'));
    if(tab === 'reconciliation') return panel('Reconciliation Evidence', appRuns.map(function(r){ return row(r.status, r.id, (r.provider_account || 'provider account') + ' - ' + fmtDate(r.completed_at)); }).join('') || empty('No reconciliation evidence for this app.'));
    if(tab === 'evidence') return '<div class="two-col">' + panel('Checkout Sessions', appSessions.map(function(s){ return row(s.plan_key, s.provider_checkout_session_ref, s.status + ' - ' + s.environment + ' - expires ' + fmtDate(s.expires_at)); }).join('') || empty('No checkout sessions in this filter.')) + panel('Evidence Rule', '<p>Financial state shown here comes from verified webhooks or explicit reconciliation results.</p><p>Do not use redirect success pages as payment proof.</p>') + '</div>';
    return '<div class="three-col">' + panel('Provider Mapping', '<p><strong>' + esc(app.provider_id) + ':' + esc(app.provider_account) + '</strong></p><p>Secrets remain server-side. Apps never receive provider keys.</p>') + panel('Operating Status', '<p>Environment filter: <strong>' + esc(state.environment) + '</strong></p><p>Selected app: <strong>' + esc(app.app_id) + '</strong></p><p>Workspace tabs keep each evidence type separate.</p>') + panel('Next Safe Action', '<p>Review plans, URLs, customers, webhooks, and reconciliation evidence in their own tabs.</p><p>Edit/add/refund actions remain disabled until their controlled tracks.</p>') + '</div>';
  }  function renderProviders(){
    var groups = {};
    apps().forEach(function(app){ var key = (app.provider_id || 'provider') + ':' + (app.provider_account || 'account'); groups[key] = groups[key] || []; groups[key].push(app); });
    el('view-providers').innerHTML = '<div class="view-header"><div><h2>Provider Accounts</h2><p>Company-scoped Stripe accounts mapped to apps. This proves isolation without exposing keys.</p></div></div><div class="list">' + Object.keys(groups).map(function(key){ return row(key, groups[key].map(function(app){ return app.app_id; }).join(', '), groups[key].length + ' app(s)'); }).join('') + '</div>';
  }
  function renderWebhooks(){
    el('view-webhooks').innerHTML = '<div class="view-header"><div><h2>Webhooks</h2><p>Recent provider events after signature verification and trusted inbox processing.</p></div></div><div class="list">' + (webhooks().map(function(w){ return row(w.event_type, w.app_id + ' / ' + w.user_ref, w.status + ' - ' + w.provider_account + ' - ' + fmtDate(w.received_at)); }).join('') || empty('No webhook events loaded.')) + '</div>';
  }
  function renderReconciliation(){
    el('view-reconciliation').innerHTML = '<div class="view-header"><div><h2>Reconciliation</h2><p>Evidence from explicit reconciliation runs. Warnings here are operator review items, not automatic browser-granted access.</p></div></div><div class="list">' + (runs().map(function(r){ return row(r.status, (r.app_id || 'unknown app') + ' / ' + (r.user_ref || 'all users'), r.provider_account + ' - ' + fmtDate(r.completed_at)); }).join('') || empty('No reconciliation runs loaded.')) + '</div>';
  }
  function renderSettings(){
    el('view-settings').innerHTML = '<div class="view-header"><div><h2>Settings</h2><p>Safe operating notes for this read-only shell.</p></div></div><div class="three-col">' + panel('PayGate Operator Identity', '<p><strong>Belongs to PayGate.</strong></p><p>Current login uses <code>OPERATOR_DIAGNOSTICS_TOKEN</code> only to create a protected admin session cookie.</p><p>Future UX: named operator accounts, roles, and audit trail.</p>') + panel('App User Identity', '<p><strong>Belongs to each app.</strong></p><p>AIntern users authenticate with their app JWT. App JWTs can create checkout/portal for that same user only.</p>') + panel('Provider Identity', '<p><strong>Belongs to Stripe/company accounts.</strong></p><p>Provider account aliases such as <code>nhl_global_solution</code> route money and webhooks. Secrets stay server-side.</p>') + '</div><div class="panel"><h3>Current Scope</h3><p>Environment filter: <strong>' + esc(state.environment) + '</strong></p><p>Loaded at: ' + esc(state.loadedAt || 'not loaded') + '</p><p>Add App, edit registry, refunds, and live-mode mutation actions are intentionally outside this slice.</p></div>';
  }
  function renderSupport(){
    var safe = { loaded_at: state.loadedAt, environment: state.environment, selected_app_id: state.selectedAppId, monitoring: state.monitoring, summary: state.summary };
    el('view-support').innerHTML = '<div class="view-header"><div><h2>Support / Debug</h2><p>Raw safe JSON is hidden here so normal operators do not start the day inside diagnostics output.</p></div></div><pre class="debug">' + esc(JSON.stringify(safe, null, 2)) + '</pre>';
  }
  function kpi(label, value, note){ return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value">' + esc(value) + '</div><div class="kpi-note">' + esc(note) + '</div></div>'; }
  function panel(title, body){ return '<section class="panel"><h3>' + esc(title) + '</h3>' + body + '</section>'; }
  function row(title, body, meta){ return '<div class="row"><div class="row-title"><span>' + esc(title) + '</span></div><div class="meta">' + esc(body) + '</div>' + (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</div>'; }
  function empty(message){ return '<div class="empty">' + esc(message) + '</div>'; }
  function customerCard(c){
    var entitlements = arr(c.entitlements).map(function(e){ return e.key + ':' + e.state; }).join(', ') || 'none';
    var subscription = c.subscription ? c.subscription.state + ' / ' + c.subscription.plan_key : 'none';
    return row(c.user_ref, 'Subscription: ' + subscription, 'Entitlements: ' + entitlements);
  }
  function recentActivity(){
    var items = [];
    webhooks().slice(0, 4).forEach(function(w){ items.push(row('Webhook: ' + w.event_type, w.app_id + ' - ' + w.status, fmtDate(w.received_at))); });
    runs().slice(0, 3).forEach(function(r){ items.push(row('Reconciliation: ' + r.status, r.app_id || 'unknown app', fmtDate(r.completed_at))); });
    return items.join('') || empty('No recent activity loaded.');
  }
  el('loginForm').addEventListener('submit', function(event){ event.preventDefault(); var token = el('operatorToken').value.trim(); if(!token){ el('loginStatus').textContent = 'Enter the operator access token first.'; return; } login(token).catch(function(e){ el('loginStatus').textContent = 'Login failed: ' + (e.body && e.body.error ? e.body.error.message : e.message); }); });
  el('logoutBtn').addEventListener('click', logout);
  el('refreshBtn').addEventListener('click', refresh);
  el('environmentFilter').addEventListener('change', refresh);
  el('appSearch').addEventListener('input', function(){ renderApps(); });
  document.querySelectorAll('.nav button[data-view]').forEach(function(btn){ btn.addEventListener('click', function(){ switchView(btn.dataset.view); }); });
  window.paygateSwitchView = switchView;
  checkSession();
})();
</script>
</body>
</html>`;
