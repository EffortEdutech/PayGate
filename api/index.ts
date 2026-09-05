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
  const url = new URL(req.url ?? "/", "https://paygate.local");
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return writeJson(res, 200, {
      status: "ok",
      service: "paygate-payment-hub",
      runtime: "vercel",
      request_id: req.headers["x-request-id"]?.toString() || `req_${randomUUID()}`,
    });
  }

  const paymentHubHandler = await getHandler();
  await paymentHubHandler(req, res);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.PAYMENT_HUB_CORS_ALLOW_ORIGIN?.trim() || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id",
    "access-control-expose-headers": "x-request-id",
  });
  res.end(JSON.stringify(body));
}