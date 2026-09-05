import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInMemoryPaymentHubRuntime } from "./runtime/runtime.js";
import { createPaymentHubHttpServer } from "./server/http-server.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtime = await createInMemoryPaymentHubRuntime(process.env, repoRoot);
const server = createPaymentHubHttpServer({ service: runtime.service, authenticator: runtime.authenticator });

server.listen(runtime.config.port, () => {
  console.log(`Payment Hub listening on http://127.0.0.1:${runtime.config.port}`);
});