export const CONSOLE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Hub Console</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e5e7eb; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    p { color: #94a3b8; line-height: 1.55; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #111827; border: 1px solid #243244; border-radius: 16px; padding: 18px; box-shadow: 0 14px 40px rgba(0,0,0,.24); }
    label { display: block; margin: 10px 0 6px; color: #cbd5e1; font-size: 13px; }
    input, select { box-sizing: border-box; width: 100%; border: 1px solid #334155; background: #020617; color: #f8fafc; border-radius: 10px; padding: 10px 12px; }
    button { border: 0; border-radius: 10px; padding: 10px 14px; background: #38bdf8; color: #082f49; font-weight: 700; cursor: pointer; }
    button.secondary { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .badge { display: inline-flex; border-radius: 999px; padding: 4px 10px; background: #1e293b; color: #cbd5e1; font-size: 12px; }
    .ok { background: #064e3b; color: #a7f3d0; }
    .warn { background: #713f12; color: #fde68a; }
    pre { white-space: pre-wrap; overflow: auto; max-height: 300px; padding: 12px; background: #020617; border-radius: 10px; border: 1px solid #1e293b; font-size: 12px; }
    a { color: #7dd3fc; }
    .muted { color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Payment Hub Console</h1>
    <p>Local sandbox console for Checkout, webhooks, entitlements, portal sessions, and reconciliation. Stripe stays behind the Hub.</p>

    <section class="grid">
      <div class="card">
        <h2>Connection</h2>
        <div class="row"><span id="health" class="badge warn">checking...</span><span class="badge">environment: test</span></div>
        <label>App token</label>
        <input id="token" type="password" placeholder="Bearer token, e.g. change-me-local-token" autocomplete="off" />
        <label>App ID</label>
        <input id="appId" value="app_analytics_pro" />
        <label>User ref</label>
        <input id="userRef" value="user_2" />
        <label>Return context</label>
        <input id="returnContext" value="billing" />
        <div class="row" style="margin-top: 14px"><button id="loadCatalog">Load catalog</button><button class="secondary" id="refreshState">Refresh state</button></div>
        <p class="muted">Token is only held in this browser tab memory. It is not embedded in the console source.</p>
      </div>

      <div class="card">
        <h2>Checkout</h2>
        <label>Plan</label>
        <select id="planKey"></select>
        <div class="row" style="margin-top: 14px"><button id="createCheckout">Create Checkout</button><button class="secondary" id="openCheckout" disabled>Open Checkout</button><button class="secondary" id="copyCheckout" disabled>Copy URL</button></div>
        <p id="checkoutSummary" class="muted">No checkout session yet.</p>
      </div>

      <div class="card">
        <h2>Portal + Reconciliation</h2>
        <div class="row"><button id="createPortal">Create Portal</button><button class="secondary" id="openPortal" disabled>Open Portal</button></div>
        <div class="row" style="margin-top: 10px"><button id="runReconciliation">Run Reconciliation</button></div>
        <p id="portalSummary" class="muted">Portal requires a provider customer from completed checkout/webhook proof.</p>
      </div>
    </section>

    <section class="grid" style="margin-top: 16px">
      <div class="card"><h2>Subscription</h2><pre id="subscriptionOut">not loaded</pre></div>
      <div class="card"><h2>Entitlements</h2><pre id="entitlementsOut">not loaded</pre></div>
      <div class="card"><h2>Recent Webhooks</h2><pre id="webhooksOut">not loaded</pre></div>
    </section>

    <section class="card" style="margin-top: 16px">
      <h2>Last Result</h2>
      <pre id="resultOut">ready</pre>
    </section>
  </main>
  <script type="module" src="/console/app.js"></script>
</body>
</html>`;

export const CONSOLE_APP_JS = String.raw`const $ = (id) => document.getElementById(id);
let checkoutUrl = "";
let portalUrl = "";

function token() { return $("token").value.trim(); }
function appId() { return $("appId").value.trim(); }
function userRef() { return $("userRef").value.trim(); }
function returnContext() { return $("returnContext").value.trim(); }
function headers(operation) {
  const value = token();
  if (!value) throw new Error("App token is required");
  const h = { Authorization: "Bearer " + value, "Content-Type": "application/json" };
  if (operation) h["Idempotency-Key"] = operation + "-" + appId() + "-" + userRef() + "-" + Date.now();
  return h;
}
function show(value) { $("resultOut").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(body, null, 2));
  return body;
}
async function checkHealth() {
  try { const body = await jsonFetch("/health"); $("health").textContent = body.status; $("health").className = "badge ok"; }
  catch { $("health").textContent = "offline"; $("health").className = "badge warn"; }
}
async function loadCatalog() {
  const body = await jsonFetch("/v1/catalog?app_id=" + encodeURIComponent(appId()) + "&environment=test", { headers: headers() });
  const select = $("planKey");
  select.innerHTML = "";
  for (const plan of body.plans ?? []) {
    const option = document.createElement("option");
    option.value = plan.plan_key;
    option.textContent = plan.name + " — " + plan.currency + " " + (plan.amount_minor / 100).toFixed(2) + (plan.interval ? "/" + plan.interval : "");
    select.appendChild(option);
  }
  show(body);
}
async function refreshState() {
  const qs = "app_id=" + encodeURIComponent(appId()) + "&user_ref=" + encodeURIComponent(userRef());
  const [subscription, entitlements, webhooks] = await Promise.all([
    jsonFetch("/v1/subscriptions/current?" + qs, { headers: headers() }),
    jsonFetch("/v1/entitlements?" + qs, { headers: headers() }),
    jsonFetch("/console/api/recent-webhooks"),
  ]);
  $("subscriptionOut").textContent = JSON.stringify(subscription, null, 2);
  $("entitlementsOut").textContent = JSON.stringify(entitlements, null, 2);
  $("webhooksOut").textContent = JSON.stringify(webhooks, null, 2);
}
async function createCheckout() {
  const body = await jsonFetch("/v1/checkout/sessions", {
    method: "POST",
    headers: headers("checkout"),
    body: JSON.stringify({ app_id: appId(), user_ref: userRef(), plan_key: $("planKey").value, return_context: returnContext(), environment: "test" })
  });
  checkoutUrl = body.redirect_url;
  $("checkoutSummary").innerHTML = "Checkout session: <code>" + body.checkout_session_id + "</code>";
  $("openCheckout").disabled = !checkoutUrl;
  $("copyCheckout").disabled = !checkoutUrl;
  show(body);
}
async function createPortal() {
  const body = await jsonFetch("/v1/billing/portal-sessions", {
    method: "POST",
    headers: headers("portal"),
    body: JSON.stringify({ app_id: appId(), user_ref: userRef(), return_context: returnContext(), environment: "test" })
  });
  portalUrl = body.redirect_url;
  $("portalSummary").innerHTML = "Portal session: <code>" + body.portal_session_id + "</code>";
  $("openPortal").disabled = !portalUrl;
  show(body);
}
async function runReconciliation() {
  const body = await jsonFetch("/internal/reconciliation/run", {
    method: "POST",
    headers: headers("reconcile"),
    body: JSON.stringify({ app_id: appId(), user_ref: userRef(), environment: "test" })
  });
  show(body);
  await refreshState();
}
function bind(id, fn) { $(id).addEventListener("click", () => fn().catch((err) => show(err.message || String(err)))); }
bind("loadCatalog", loadCatalog);
bind("refreshState", refreshState);
bind("createCheckout", createCheckout);
bind("createPortal", createPortal);
bind("runReconciliation", runReconciliation);
$("openCheckout").addEventListener("click", () => checkoutUrl && window.open(checkoutUrl, "_blank", "noopener,noreferrer"));
$("openPortal").addEventListener("click", () => portalUrl && window.open(portalUrl, "_blank", "noopener,noreferrer"));
$("copyCheckout").addEventListener("click", () => checkoutUrl && navigator.clipboard.writeText(checkoutUrl).then(() => show("Checkout URL copied")));
checkHealth();`;

