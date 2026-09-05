import type { IncomingMessage, ServerResponse } from "node:http";
import { createPostgresPaymentHubRuntime } from "../payment-hub/src/runtime/runtime.js";
import { createPaymentHubHttpHandler } from "../payment-hub/src/server/http-server.js";

let handlerPromise: Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> | undefined;

async function getHandler() {
  handlerPromise ??= createPostgresPaymentHubRuntime(process.env, process.cwd()).then((runtime) => createPaymentHubHttpHandler({
    service: runtime.service,
    authenticator: runtime.authenticator,
    idempotencyLedger: runtime.idempotencyLedger,
  }));
  return handlerPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const paymentHubHandler = await getHandler();
  await paymentHubHandler(req, res);
}