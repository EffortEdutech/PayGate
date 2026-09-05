import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

let handlerPromise: Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> | undefined;

async function getHandler() {
  handlerPromise ??= Promise.all([
    import("../payment-hub/src/runtime/runtime.js"),
    import("../payment-hub/src/server/http-server.js"),
  ]).then(([runtimeModule, serverModule]) => runtimeModule.createPostgresPaymentHubRuntime(process.env, process.cwd()).then((runtime) => serverModule.createPaymentHubHttpHandler({
    service: runtime.service,
    authenticator: runtime.authenticator,
    idempotencyLedger: runtime.idempotencyLedger,
  })));
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

  if (req.method === "GET" && url.pathname === "/diagnostics/runtime") {
    return writeJson(res, 200, runtimeDiagnostics(requestId));
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