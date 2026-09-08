import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

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
  if (scheme !== "Bearer" || !presentedToken || !constantTimeEqual(presentedToken, configuredToken)) {
    return {
      status: 401,
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "Operator diagnostics require a valid bearer token.",
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
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN?.trim() || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id,stripe-signature",
    "access-control-expose-headers": "x-request-id",
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
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #ecfeff 100%); }
    main { max-width: 1280px; margin: 0 auto; padding: 28px 20px 56px; }
    h1 { margin: 0; font-size: 34px; letter-spacing: -0.04em; }
    h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: -0.02em; }
    h3 { margin: 0 0 8px; font-size: 15px; }
    p { margin: 8px 0; line-height: 1.5; }
    input, button, select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 12px; font: inherit; }
    input, select { background: white; color: #0f172a; }
    button { cursor: pointer; background: #0f172a; color: white; border-color: #0f172a; font-weight: 700; }
    button.secondary { background: white; color: #0f172a; }
    section { background: rgba(255,255,255,0.88); border: 1px solid #dbe4f0; border-radius: 22px; padding: 18px; margin: 16px 0; box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08); backdrop-filter: blur(10px); }
    .hero { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr); gap: 16px; align-items: stretch; }
    .panel { background: rgba(15, 23, 42, 0.96); color: #e2e8f0; border-radius: 22px; padding: 20px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .toolbar { display: grid; grid-template-columns: minmax(260px, 1.5fr) minmax(180px, .8fr) minmax(140px, .5fr) auto; gap: 10px; align-items: end; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .wide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; background: #fff; min-width: 0; }
    .card.dark { background: #111827; color: #e5e7eb; border-color: #334155; }
    .metric { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; }
    .muted { color: #64748b; }
    .small { font-size: 13px; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 10px; background: #e2e8f0; color: #334155; font-size: 12px; font-weight: 700; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.danger { background: #fee2e2; color: #991b1b; }
    .badge.info { background: #dbeafe; color: #1e40af; }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 7px; overflow-wrap: anywhere; }
    .dark code { background: #1e293b; color: #bae6fd; }
    pre { white-space: pre-wrap; background: #0f172a; color: #e2e8f0; border-radius: 14px; padding: 14px; overflow: auto; max-height: 420px; }
    details summary { cursor: pointer; font-weight: 800; }
    .empty { padding: 14px; border: 1px dashed #cbd5e1; border-radius: 14px; color: #64748b; background: #f8fafc; }
    .step { display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: start; margin: 10px 0; }
    .step-num { width: 26px; height: 26px; border-radius: 999px; display: inline-grid; place-items: center; background: #0f172a; color: white; font-size: 12px; font-weight: 800; }
    @media (max-width: 860px) { .hero, .toolbar { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <div class="hero">
      <section class="panel">
        <p class="badge info">Read-only operator dashboard</p>
        <h1>PayGate Operator Console</h1>
        <p>Manage the gateway from the operator view: apps, provider accounts, plans, webhooks, entitlements, reconciliation, and setup readiness. Secrets stay server-side. Apps stay payment consumers.</p>
        <div class="row" style="margin-top: 14px">
          <span class="badge">Stripe behind PayGate</span>
          <span class="badge">Sandbox/live separated</span>
          <span class="badge">No refund actions in this slice</span>
        </div>
      </section>
      <section>
        <h2>Connection</h2>
        <div class="toolbar">
          <label><span class="small muted">Operator token</span><input id="token" type="password" placeholder="OPERATOR_DIAGNOSTICS_TOKEN" autocomplete="off" /></label>
          <label><span class="small muted">App filter</span><input id="appId" placeholder="app_id" value="aintern" /></label>
          <label><span class="small muted">Environment</span><select id="environment"><option value="live">live</option><option value="test">test</option><option value="">all</option></select></label>
          <button id="refresh">Refresh</button>
        </div>
        <p id="status" class="muted small">Not loaded. Token is held only in this browser tab memory.</p>
      </section>
    </div>

    <section>
      <h2>Dashboard</h2>
      <div id="dashboard" class="grid"><div class="empty">Load data to see gateway status.</div></div>
    </section>

    <section>
      <h2>Next Safe Action</h2>
      <div id="nextAction" class="card">Refresh the dashboard first. The console will suggest the next safe operator action.</div>
    </section>

    <section>
      <h2>Apps and Plans</h2>
      <div id="apps" class="wide-grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>Provider Accounts</h2>
      <div id="providerAccounts" class="grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>Customers and Entitlements</h2>
      <div id="customers" class="wide-grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>Checkout Sessions</h2>
      <div id="checkouts" class="wide-grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>Webhooks</h2>
      <div id="webhooks" class="wide-grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>Reconciliation</h2>
      <div id="reconciliation" class="wide-grid"><div class="empty">No data loaded.</div></div>
    </section>

    <section>
      <h2>App Onboarding Checklist</h2>
      <div id="onboarding" class="grid"></div>
    </section>

    <section>
      <details>
        <summary>Last Raw Summary</summary>
        <pre id="raw">{}</pre>
      </details>
    </section>
  </main>
<script>
var $ = function (id) { return document.getElementById(id); };
function esc(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]; }); }
function badge(value, tone) { return '<span class="badge ' + esc(tone || '') + '">' + esc(value) + '</span>'; }
function line(label, value) { return '<p><span class="muted small">' + esc(label) + '</span><br />' + value + '</p>'; }
function card(title, lines, extraClass) { return '<div class="card ' + esc(extraClass || '') + '"><h3>' + esc(title) + '</h3>' + lines.join('') + '</div>'; }
function renderList(id, items, empty, render) { $(id).innerHTML = items && items.length ? items.map(render).join('') : '<div class="empty">' + esc(empty) + '</div>'; }
function envTone(env) { return env === 'live' ? 'warn' : env === 'test' ? 'info' : ''; }
function statusTone(status) { return status === 'ok' || status === 'ready' || status === 'processed' || status === 'active' ? 'ok' : status === 'attention_required' || status === 'open' ? 'warn' : status ? 'danger' : ''; }
function money(plan) { return esc(plan.currency || '') + ' ' + ((Number(plan.amount_minor || 0) / 100).toFixed(2)); }
function currentParams() {
  var params = new URLSearchParams();
  if ($("appId").value.trim()) params.set("app_id", $("appId").value.trim());
  if ($("environment").value) params.set("environment", $("environment").value);
  return params;
}
async function fetchJson(url, token) {
  var response = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  var body = await response.json().catch(function () { return {}; });
  return { ok: response.ok, status: response.status, body: body };
}
function renderDashboard(summary, monitoring) {
  var apps = summary.apps || [];
  var customers = summary.customers || [];
  var webhooks = summary.webhooks || [];
  var reconciliations = summary.reconciliation_runs || [];
  var alerts = monitoring.alerts || [];
  var providerAccounts = collectProviderAccounts(apps);
  var webhookChecks = monitoring.checks && monitoring.checks.webhook_inbox || {};
  var reconciliationChecks = monitoring.checks && monitoring.checks.reconciliation || {};
  $("dashboard").innerHTML = [
    card('Overall status', [line('Monitoring', badge(monitoring.status || 'unknown', statusTone(monitoring.status))), line('Alerts', alerts.length ? alerts.map(function (a) { return badge(a.severity + ':' + a.code, a.severity === 'critical' ? 'danger' : 'warn'); }).join(' ') : badge('none', 'ok'))], 'dark'),
    card('Apps', [line('Registered apps in view', '<span class="metric">' + apps.length + '</span>'), line('Provider accounts', providerAccounts.map(function (p) { return badge(p, 'info'); }).join(' ') || 'none')]),
    card('Webhooks', [line('Recent events in view', '<span class="metric">' + webhooks.length + '</span>'), line('Pending/retry/dead', '<code>' + esc((webhookChecks.pending || 0) + '/' + (webhookChecks.retryable || 0) + '/' + (webhookChecks.deadLetter || 0)) + '</code>')]),
    card('Reconciliation', [line('Recent runs in view', '<span class="metric">' + reconciliations.length + '</span>'), line('Failed/no customer/no subscription', '<code>' + esc((reconciliationChecks.failed || 0) + '/' + (reconciliationChecks.noProviderCustomer || 0) + '/' + (reconciliationChecks.noProviderSubscription || 0)) + '</code>')]),
    card('Customers', [line('Customers in view', '<span class="metric">' + customers.length + '</span>'), line('Entitlement source', 'Verified webhooks or explicit reconciliation only')])
  ].join('');
  renderNextAction(summary, monitoring);
}
function renderNextAction(summary, monitoring) {
  var alerts = monitoring.alerts || [];
  var apps = summary.apps || [];
  if (alerts.some(function (a) { return a.severity === 'critical'; })) {
    $("nextAction").innerHTML = '<strong>Critical attention required.</strong><p>Open Monitoring and Webhooks first. Do not onboard another app until critical alerts are cleared.</p>';
    return;
  }
  if (!apps.length) {
    $("nextAction").innerHTML = '<strong>No app found for this filter.</strong><p>Clear the app filter or start app intake only after confirming the app ID.</p>';
    return;
  }
  var missingLiveLookup = apps.some(function (app) { return (app.plans || []).some(function (plan) { return !plan.live_provider_lookup_configured; }); });
  if (missingLiveLookup) {
    $("nextAction").innerHTML = '<strong>Plan lookup configuration needs review.</strong><p>Check Plans and Prices before any live operation. Apps must use plan keys only; PayGate owns lookup keys.</p>';
    return;
  }
  if (alerts.length) {
    $("nextAction").innerHTML = '<strong>Warnings exist, but no critical alert.</strong><p>Review reconciliation warnings. For one-time payment plans, no provider subscription can be expected.</p>';
    return;
  }
  $("nextAction").innerHTML = '<strong>Safe next step: build the app onboarding wizard.</strong><p>The current view is healthy enough to proceed with UI-guided app #2 intake, still without live payment/refund actions.</p>';
}
function collectProviderAccounts(apps) {
  var set = {};
  apps.forEach(function (app) { if (app.provider_account) set[(app.provider_id || 'provider') + ':' + app.provider_account] = true; });
  return Object.keys(set).sort();
}
function renderApps(apps) {
  renderList("apps", apps || [], "No apps.", function (app) {
    var plans = (app.plans || []).map(function (plan) {
      return '<div class="card"><strong>' + esc(plan.plan_key) + '</strong> ' + badge(plan.status, statusTone(plan.status)) + '<br />' + esc(plan.name) + '<br />' + money(plan) + ' · ' + esc(plan.mode) + '<br /><span class="small muted">lookup:</span> ' + badge(plan.provider_lookup_configured ? 'sandbox ok' : 'sandbox missing', plan.provider_lookup_configured ? 'ok' : 'danger') + ' ' + badge(plan.live_provider_lookup_configured ? 'live ok' : 'live missing', plan.live_provider_lookup_configured ? 'ok' : 'warn') + '<br /><span class="small muted">entitlements:</span> ' + esc((plan.entitlements || []).join(', ') || 'none') + '</div>';
    }).join('');
    return card(app.app_id, [
      line('Name', esc(app.name)),
      line('Provider account', '<code>' + esc(app.provider_id) + ':' + esc(app.provider_account) + '</code>'),
      line('Origins', badge('test', 'info') + ' ' + esc(app.origins && app.origins.test || 'missing') + '<br />' + badge('live', 'warn') + ' ' + esc(app.origins && app.origins.live || 'missing')),
      line('Plans', plans || 'No plans configured')
    ]);
  });
}
function renderProviderAccounts(apps) {
  var rows = {};
  (apps || []).forEach(function (app) {
    var key = (app.provider_id || 'provider') + ':' + (app.provider_account || 'unknown');
    if (!rows[key]) rows[key] = { key: key, apps: [], plans: 0, liveReady: 0, sandboxReady: 0 };
    rows[key].apps.push(app.app_id);
    (app.plans || []).forEach(function (plan) { rows[key].plans += 1; if (plan.provider_lookup_configured) rows[key].sandboxReady += 1; if (plan.live_provider_lookup_configured) rows[key].liveReady += 1; });
  });
  renderList("providerAccounts", Object.values(rows), "No provider accounts.", function (row) {
    return card(row.key, [line('Linked apps', row.apps.map(function (app) { return badge(app, 'info'); }).join(' ')), line('Plan lookup readiness', badge('sandbox ' + row.sandboxReady + '/' + row.plans, row.sandboxReady === row.plans ? 'ok' : 'warn') + ' ' + badge('live ' + row.liveReady + '/' + row.plans, row.liveReady === row.plans ? 'ok' : 'warn')), line('Secrets', 'Hidden server-side')]);
  });
}
function renderCustomers(customers) {
  renderList("customers", customers || [], "No customers.", function (c) {
    return card((c.app_id || 'app') + ' / ' + (c.user_ref || 'user'), [
      line('PayGate state', badge(c.subscription && c.subscription.state || 'none', statusTone(c.subscription && c.subscription.state)) + ' ' + esc(c.subscription && c.subscription.plan_key || '')),
      line('Provider customers', ((c.provider_customers || []).map(function (pc) { return '<code>' + esc(pc.provider_account + ':' + pc.environment + ':' + pc.provider_customer_ref) + '</code>'; }).join('<br />')) || 'none'),
      line('Entitlements', ((c.entitlements || []).map(function (e) { return badge(e.key + '=' + e.state, statusTone(e.state)); }).join(' ')) || 'none')
    ]);
  });
}
function renderCheckouts(sessions) {
  renderList("checkouts", sessions || [], "No checkout sessions.", function (s) {
    return card(s.provider_checkout_session_ref || 'session', [line('App/user', esc(s.app_id) + ' / ' + esc(s.user_ref)), line('Provider/env', '<code>' + esc(s.provider_id) + ':' + esc(s.provider_account) + ':' + esc(s.environment) + '</code>'), line('Plan/status', badge(s.plan_key, 'info') + ' ' + badge(s.status, statusTone(s.status))), line('Created/expires', esc(s.created_at) + '<br />' + esc(s.expires_at || ''))]);
  });
}
function renderWebhooks(webhooks) {
  renderList("webhooks", webhooks || [], "No webhooks.", function (w) {
    return card(w.provider_event_id || 'event', [line('Type/status', '<code>' + esc(w.event_type) + '</code> ' + badge(w.status, statusTone(w.status))), line('Provider/env', '<code>' + esc(w.provider_id) + ':' + esc(w.provider_account) + ':' + esc(w.environment) + '</code>'), line('App/user', esc(w.app_id || 'unknown') + ' / ' + esc(w.user_ref || 'unknown')), line('Received/processed', esc(w.received_at || '') + '<br />' + esc(w.processed_at || ''))]);
  });
}
function renderReconciliation(runs) {
  renderList("reconciliation", runs || [], "No reconciliation runs.", function (r) {
    var note = r.status === 'no_provider_subscription' ? 'For one-time payment plans this can be expected; PayGate state is still the authority.' : esc(r.classification || 'none');
    return card(r.id || 'run', [line('Status', badge(r.status || 'unknown', statusTone(r.status))), line('Classification/note', note), line('Provider/env', '<code>' + esc(r.provider_id) + ':' + esc(r.provider_account) + ':' + esc(r.environment) + '</code>'), line('App/user', esc(r.app_id || '') + ' / ' + esc(r.user_ref || '')), line('Completed', esc(r.completed_at || ''))]);
  });
}
function renderOnboarding() {
  var steps = [
    'Confirm app owner, repository, production URL, and sandbox URL.',
    'Confirm user identity and app auth boundary.',
    'Choose company-scoped provider account alias.',
    'Define PayGate-owned plans, prices, lookup keys, and entitlements.',
    'Configure Stripe products/prices and webhook endpoint.',
    'Run registry validation and provider isolation tests.',
    'Complete sandbox checkout, webhook, entitlement, portal, and reconciliation proof.',
    'Record evidence before any live-mode approval.'
  ];
  $("onboarding").innerHTML = steps.map(function (step, index) { return '<div class="card"><div class="step"><span class="step-num">' + (index + 1) + '</span><p>' + esc(step) + '</p></div></div>'; }).join('');
}
async function refresh() {
  var token = $("token").value.trim();
  if (!token) { $("status").textContent = 'Operator token is required.'; return; }
  var params = currentParams();
  $("status").textContent = 'Loading...';
  var monitoringResult = await fetchJson('/admin/monitoring?' + params.toString(), token);
  var summaryResult = await fetchJson('/admin/summary?' + params.toString(), token);
  $("raw").textContent = JSON.stringify({ monitoring: monitoringResult.body, summary: summaryResult.body }, null, 2);
  if (!monitoringResult.ok) {
    $("dashboard").innerHTML = card('Monitoring error', [line('HTTP', '<code>' + esc(monitoringResult.status) + '</code>'), line('Code', '<code>' + esc(monitoringResult.body && monitoringResult.body.error && monitoringResult.body.error.code || 'unknown') + '</code>'), line('Message', esc(monitoringResult.body && monitoringResult.body.error && monitoringResult.body.error.message || 'Unable to load monitoring'))], '');
  }
  if (!summaryResult.ok) {
    $("status").textContent = summaryResult.status + ': ' + (summaryResult.body && summaryResult.body.error && summaryResult.body.error.code || 'error');
    return;
  }
  var summary = summaryResult.body || {};
  var monitoring = monitoringResult.ok ? monitoringResult.body : { status: 'attention_required', alerts: [{ severity: 'warning', code: 'MONITORING_UNAVAILABLE' }], checks: {} };
  $("status").textContent = 'Loaded ' + summary.generated_at + ' · filter app=' + ($("appId").value.trim() || 'all') + ' env=' + ($("environment").value || 'all');
  renderDashboard(summary, monitoring);
  renderApps(summary.apps || []);
  renderProviderAccounts(summary.apps || []);
  renderCustomers(summary.customers || []);
  renderCheckouts(summary.checkout_sessions || []);
  renderWebhooks(summary.webhooks || []);
  renderReconciliation(summary.reconciliation_runs || []);
  renderOnboarding();
}
renderOnboarding();
$("refresh").addEventListener("click", function () { refresh().catch(function (error) { $("status").textContent = error.message; }); });
</script>
</body>
</html>`;