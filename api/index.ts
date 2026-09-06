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
  const checks = [
    checkPlainUrl("APP_AUTH_ISSUER", process.env.APP_AUTH_ISSUER, true),
    checkPlainUrl("PAYMENT_HUB_CORS_ALLOW_ORIGIN", process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN, false),
    checkPlainUrl("SUPABASE_JWKS_URL", process.env.SUPABASE_JWKS_URL, true),
    checkPlainUrl("SUPABASE_JWT_ISSUER", process.env.SUPABASE_JWT_ISSUER, true),
    checkRequired("APP_AUTH_AUDIENCE", process.env.APP_AUTH_AUDIENCE),
    checkRequired("SUPABASE_JWT_APP_ID", process.env.SUPABASE_JWT_APP_ID),
    checkRequired("SUPABASE_JWT_AUDIENCE", process.env.SUPABASE_JWT_AUDIENCE),
    checkStripeAccounts(accounts),
    checkDatabaseUrl(process.env.DATABASE_URL),
    ...accounts.flatMap((account) => [
      checkSecret(envNameForProviderAccount(account, "SECRET_KEY"), process.env[envNameForProviderAccount(account, "SECRET_KEY")], "sk_test_"),
      checkSecret(envNameForProviderAccount(account, "WEBHOOK_SECRET"), process.env[envNameForProviderAccount(account, "WEBHOOK_SECRET")], "whsec_"),
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
    checks.push({ name: "RUNTIME_CREATE", ok: true, stripe_accounts: runtime.config.stripeAccounts.map((account: { account: string }) => account.account), supabase_jwks: Boolean(runtime.config.supabaseJwtAuth?.jwksUrl) });
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

function checkStripeAccounts(accounts: string[]): unknown {
  return {
    name: "STRIPE_ACCOUNTS",
    ok: accounts.includes("nhl_global_solution"),
    present: accounts.length > 0,
    accounts,
    ...(accounts.includes("nhl_global_solution") ? {} : { issue: "Expected nhl_global_solution in STRIPE_ACCOUNTS." }),
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
  return `STRIPE_ACCOUNT_${account.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
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
  <title>PayGate Admin Console</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111827; background: #f8fafc; }
    input, button, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; }
    button { cursor: pointer; background: #111827; color: white; }
    section { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; margin: 16px 0; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; }
    .muted { color: #64748b; }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
    pre { white-space: pre-wrap; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 12px; overflow: auto; }
  </style>
</head>
<body>
  <h1>PayGate Admin Console</h1>
  <p class="muted">Read-only operator view. Token is kept only in this browser tab memory.</p>
  <section>
    <div class="row">
      <input id="token" type="password" placeholder="Operator diagnostics token" size="36" />
      <input id="appId" placeholder="app_id filter, optional" value="aintern" />
      <select id="environment"><option value="test">test</option><option value="live">live</option><option value="">all</option></select>
      <button id="refresh">Refresh</button>
    </div>
    <p id="status" class="muted">Not loaded.</p>
  </section>
  <section><h2>Apps and Plans</h2><div id="apps" class="grid"></div></section>
  <section><h2>Customers</h2><div id="customers" class="grid"></div></section>
  <section><h2>Checkout Sessions</h2><div id="checkouts" class="grid"></div></section>
  <section><h2>Recent Webhooks</h2><div id="webhooks" class="grid"></div></section>
  <section><h2>Reconciliation Runs</h2><div id="reconciliation" class="grid"></div></section>
  <section><h2>Last Raw Summary</h2><pre id="raw">{}</pre></section>
<script>
var $ = function (id) { return document.getElementById(id); };
function esc(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]; }); }
function card(title, lines) { return '<div class="card"><h3>' + esc(title) + '</h3>' + lines.map(function (line) { return '<p>' + line + '</p>'; }).join('') + '</div>'; }
function renderList(id, items, empty, render) { $(id).innerHTML = items.length ? items.map(render).join('') : '<p class="muted">' + empty + '</p>'; }
async function refresh() {
  var token = $("token").value;
  var params = new URLSearchParams();
  if ($("appId").value.trim()) params.set("app_id", $("appId").value.trim());
  if ($("environment").value) params.set("environment", $("environment").value);
  var response = await fetch('/admin/summary?' + params.toString(), { headers: { authorization: 'Bearer ' + token } });
  var body = await response.json();
  $("raw").textContent = JSON.stringify(body, null, 2);
  if (!response.ok) { $("status").textContent = response.status + ': ' + (body.error && body.error.code ? body.error.code : 'error'); return; }
  $("status").textContent = 'Loaded ' + body.generated_at;
  renderList("apps", body.apps || [], "No apps.", function (app) { return card(app.app_id, ['Provider: <code>' + esc(app.provider_id) + ':' + esc(app.provider_account) + '</code>', 'Plans: ' + ((app.plans || []).map(function (p) { return esc(p.plan_key + ' / ' + p.status); }).join(', '))]); });
  renderList("customers", body.customers || [], "No customers.", function (c) { return card(c.app_id + ' / ' + c.user_ref, ['Subscription: <code>' + esc(c.subscription && c.subscription.state) + ' ' + esc(c.subscription && c.subscription.plan_key || '') + '</code>', 'Provider customers: ' + (((c.provider_customers || []).map(function (pc) { return esc(pc.provider_account + ':' + pc.provider_customer_ref); }).join(', ')) || 'none'), 'Entitlements: ' + (((c.entitlements || []).map(function (e) { return esc(e.key + '=' + e.state); }).join(', ')) || 'none')]); });
  renderList("checkouts", body.checkout_sessions || [], "No checkout sessions.", function (s) { return card(s.provider_checkout_session_ref, [esc(s.app_id) + ' / ' + esc(s.user_ref), 'Plan: <code>' + esc(s.plan_key) + '</code>', 'Status: ' + esc(s.status), 'Created: ' + esc(s.created_at)]); });
  renderList("webhooks", body.webhooks || [], "No webhooks.", function (w) { return card(w.provider_event_id, [esc(w.provider_account) + ' / ' + esc(w.environment), 'Type: <code>' + esc(w.event_type) + '</code>', 'Status: ' + esc(w.status) + ' attempts=' + esc(w.attempt_count), 'App/User: ' + esc(w.app_id) + ' / ' + esc(w.user_ref)]); });
  renderList("reconciliation", body.reconciliation_runs || [], "No reconciliation runs.", function (r) { return card(r.id, [esc(r.app_id) + ' / ' + esc(r.user_ref), 'Status: <code>' + esc(r.status) + '</code>', 'Classification: ' + esc(r.classification || 'none'), 'Completed: ' + esc(r.completed_at)]); });
}
$("refresh").addEventListener("click", function () { refresh().catch(function (error) { $("status").textContent = error.message; }); });
</script>
</body>
</html>`;