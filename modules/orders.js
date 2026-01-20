// modules/orders.js
export function initOrdersManagement({ supabaseClient, ui, helpers, state }) {
  const { show, escapeHtml, formatDateShort } = helpers;

  const {
    // view containers
    viewOrders,
    ordersCreateBtn,

    // list UI
    ordersMsg,
    ordersListPanel,
    ordersSearch,
    ordersSearchBtn,
    ordersShowAllBtn,
    ordersStatusFilter,
    ordersList,

    // detail UI
    ordersDetailPanel,
    ordersDetailTitle,
    ordersDetailMeta,
    ordersBackBtn,
    ordersRefreshBtn,
    ordersGeneratePackBtn,

    // outputs
    ordersBatchSummary,
    ordersArtifactsList,
  } = ui;

  // Admin-only buttons live in index.html (not in ui map)
  const ordersMarkPaidBtn = document.getElementById("ordersMarkPaidBtn");
  const ordersCompBtn = document.getElementById("ordersCompBtn");

  // Payment (Stripe) UI lives in index.html (not in ui map)
  const ordersPayPanel = document.getElementById("ordersPayPanel");
  const ordersPayMsg = document.getElementById("ordersPayMsg");
  const ordersPayBtn = document.getElementById("ordersPayBtn");
  const ordersPayCancelBtn = document.getElementById("ordersPayCancelBtn");
  const stripePaymentEl = document.getElementById("stripePaymentEl");

  let selectedOrderId = null;

  const getRole = () => String(state?.currentProfile?.role || "").toLowerCase();
  const isAdminNow = () => getRole() === "admin";
  const canGeneratePackNow = () => {
    const r = getRole();
    return r === "admin" || r === "agent";
  };

  const setMsg = (t) => { if (ordersMsg) ordersMsg.textContent = t || ""; };

  function resetScreen() {
    setMsg("");
    selectedOrderId = null;

    if (ordersList) ordersList.innerHTML = "";
    if (ordersBatchSummary) ordersBatchSummary.innerHTML = "";
    if (ordersArtifactsList) ordersArtifactsList.innerHTML = "";

    show(ordersListPanel, true);
    show(ordersDetailPanel, false);
  }

  // ---------------------------------------------------------
  // Create Order modal
  // ---------------------------------------------------------
  function renderCreateOrderModal({ customers, agent, onSubmit, onCancel }) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "999999";

    const card = document.createElement("div");
    card.className = "card";
    card.style.width = "min(620px, calc(100vw - 32px))";

    card.innerHTML = `
      <h3 style="margin-top:0;">Create Order</h3>

      <label class="subtle">Customer</label>
      <select id="coCustomer" style="width:100%; margin-bottom:10px;">
        <option value="">Select customer…</option>
        ${(customers || []).map(c =>
          `<option value="${c.id}">${escapeHtml([c.first_name, c.last_name].filter(Boolean).join(" "))}</option>`
        ).join("")}
      </select>

      <label class="subtle">Dispatch to</label>
      <select id="coDispatchTo" style="width:100%; margin-bottom:10px;">
        <option value="customer">Customer</option>
        <option value="agent">Agent</option>
        <option value="other">Other</option>
      </select>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div>
          <label class="subtle">Ship to name</label>
          <input id="coShipName" placeholder="Full name" style="width:100%; margin-bottom:10px;" />
        </div>
        <div>
          <label class="subtle">Ship to phone</label>
          <input id="coShipPhone" placeholder="+971..." style="width:100%; margin-bottom:10px;" />
        </div>
      </div>

      <label class="subtle">Ship to email</label>
      <input id="coShipEmail" placeholder="email@example.com" style="width:100%; margin-bottom:10px;" />

      <label class="subtle">Ship to address</label>
      <textarea id="coShipAddress" rows="3" placeholder="Address" style="width:100%; margin-bottom:10px;"></textarea>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div>
          <label class="subtle">City</label>
          <input id="coShipCity" placeholder="City" style="width:100%; margin-bottom:10px;" />
        </div>
        <div>
          <label class="subtle">Country</label>
          <input id="coShipCountry" placeholder="Country" style="width:100%; margin-bottom:10px;" />
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
        <button id="coCancelBtn" type="button">Cancel</button>
        <button id="coCreateBtn" class="btn-success" type="button">Create</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const $cust = overlay.querySelector("#coCustomer");
    const $dispatch = overlay.querySelector("#coDispatchTo");

    const $name = overlay.querySelector("#coShipName");
    const $phone = overlay.querySelector("#coShipPhone");
    const $email = overlay.querySelector("#coShipEmail");
    const $addr = overlay.querySelector("#coShipAddress");
    const $city = overlay.querySelector("#coShipCity");
    const $country = overlay.querySelector("#coShipCountry");

    function fillFromCustomer(c) {
      if (!c) return;
      $name.value = [c.first_name, c.last_name].filter(Boolean).join(" ");
      $phone.value = c.phone || "";
      $email.value = c.email || "";
      $addr.value = c.shipping_address || "";
      $city.value = c.shipping_city || "";
      $country.value = c.shipping_country || "";
    }

    function fillFromAgent(a) {
      if (!a) return;
      $name.value = a.name || "";
      $phone.value = a.phone || "";
      $email.value = a.email || "";
      $addr.value = a.shipping_address || "";
      $city.value = a.shipping_city || "";
      $country.value = a.shipping_country || "";
    }

    function applyDispatchDefaults() {
      const dispatch_to = String($dispatch.value || "customer");

      if (dispatch_to === "agent") {
        fillFromAgent(agent);
        return;
      }

      if (dispatch_to === "customer") {
        const id = String($cust.value || "");
        const c = (customers || []).find(x => x.id === id);
        fillFromCustomer(c);
        return;
      }

      // other: do nothing (leave editable fields as-is)
    }

    $cust?.addEventListener("change", () => {
      if (String($dispatch.value) === "customer") applyDispatchDefaults();
    });
    $dispatch?.addEventListener("change", () => applyDispatchDefaults());

    if ((customers || []).length === 1) $cust.value = customers[0].id;
    applyDispatchDefaults();

    const cleanup = () => overlay.remove();

    overlay.querySelector("#coCancelBtn").onclick = () => {
      cleanup();
      onCancel?.();
    };

    overlay.querySelector("#coCreateBtn").onclick = () => {
      const customer_id = String($cust.value || "");
      const dispatch_to = String($dispatch.value || "customer");

      const ship_to_name = String($name.value || "").trim();
      const ship_to_phone = String($phone.value || "").trim() || null;
      const ship_to_email = String($email.value || "").trim() || null;
      const ship_to_address = String($addr.value || "").trim();
      const ship_to_city = String($city.value || "").trim() || null;
      const ship_to_country = String($country.value || "").trim() || null;

      if (!customer_id) return;
      if (!ship_to_name) return;
      if (!ship_to_address) return;

      cleanup();
      onSubmit({
        customer_id,
        dispatch_to,
        ship_to_name,
        ship_to_phone,
        ship_to_email,
        ship_to_address,
        ship_to_city,
        ship_to_country,
      });
    };
  }

  // ---------------------------------------------------------
  // List
  // ---------------------------------------------------------
  function renderOrderRow(o) {
    const code = escapeHtml(o.order_code || o.id);
    const status = escapeHtml(o.status || "—");
    const created = o.created_at ? escapeHtml(formatDateShort(o.created_at)) : "—";

    const cust = o.customer?.first_name || o.customer?.last_name
      ? `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim()
      : "—";

    return `
      <div class="customer-row" data-order-id="${escapeHtml(o.id)}" style="cursor:pointer;">
        <div style="font-weight:800;">${code}</div>
        <div class="subtle" style="margin-top:4px;">
          ${isAdminNow() ? `Payment: ${escapeHtml(o.payment_status || "—")} • ` : ""}Status: ${status} • Created: ${created} • Customer: ${escapeHtml(cust)}

        </div>
      </div>
    `;
  }

  async function loadOrders({ mode }) {
    setMsg("Loading orders…");

    const status = String(ordersStatusFilter?.value || "").trim();
    const q = String(ordersSearch?.value || "").trim();

    let query = supabaseClient
      .from("orders")
      .select(`
        id,
        order_code,
        status,
        payment_status,
        created_at,
        customer_id,
        customer:customers (
          id,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);

    if (mode === "search" && q) {
      query = query.ilike("order_code", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) { setMsg("Load failed: " + error.message); return; }

    const rows = data || [];
    if (ordersList) ordersList.innerHTML = rows.map(renderOrderRow).join("");
    setMsg(`Loaded ${rows.length} orders.`);
  }

  // ---------------------------------------------------------
  // Batch summary
  // ---------------------------------------------------------
  async function loadBatchSummaryFromBatches(orderId) {
    if (!ordersBatchSummary) return;
    ordersBatchSummary.innerHTML = `<div class="subtle">Loading…</div>`;

    const { data, error } = await supabaseClient
      .from("order_batches")
      .select("formula_key, batch_code, lab_batch_code")
      .eq("order_id", orderId)
      .order("formula_key", { ascending: true });

    if (error) {
      ordersBatchSummary.innerHTML = `<div class="subtle">Load batches failed: ${escapeHtml(error.message)}</div>`;
      return;
    }

    const batches = Array.isArray(data) ? data : [];
    if (!batches.length) {
      ordersBatchSummary.innerHTML = `<div class="subtle">No batches yet (generate pack to create).</div>`;
      return;
    }

    const header = `
      <div class="customer-row" style="font-weight:800;">
        <div>formula_key</div>
        <div>exact_batch_code</div>
        <div>fill_ml</div>
        <div>process_profile</div>
      </div>
    `;

    const metaForKey = (k) => {
      const key = String(k || "").toLowerCase();
      if (key === "eye") return { fill_ml: 15, process_profile: "gel_process_v1" };
      if (key === "day" || key === "night") return { fill_ml: 50, process_profile: "standard_emulsion_v1" };
      return { fill_ml: "—", process_profile: "—" };
    };

    const body = batches.map(b => {
      const fk = escapeHtml(b.formula_key || "—");
      const batch = escapeHtml(b.batch_code || "—");
      const meta = metaForKey(b.formula_key);
      const fill = escapeHtml(String(meta.fill_ml));
      const proc = escapeHtml(String(meta.process_profile));

      return `
        <div class="customer-row">
          <div>${fk}</div>
          <div>${batch}</div>
          <div>${fill}</div>
          <div>${proc}</div>
        </div>
      `;
    }).join("");

    ordersBatchSummary.innerHTML = header + body;
  }

  // ---------------------------------------------------------
  // Artifacts (admin-only)
  // ---------------------------------------------------------
  async function loadArtifacts(orderId) {
    if (!ordersArtifactsList) return;
    ordersArtifactsList.innerHTML = `<div class="subtle">Loading…</div>`;

    const { data, error } = await supabaseClient
      .from("order_artifacts")
      .select("id, artifact_type, format, version, created_at")
      .eq("order_id", orderId)
      .order("version", { ascending: false });

    if (error) { setMsg("Load artifacts failed: " + error.message); return; }

    const rows = data || [];
    if (!rows.length) {
      ordersArtifactsList.innerHTML = `<div class="subtle">No artifacts yet.</div>`;
      return;
    }

    const items = rows.map(a => {
      const created = a.created_at ? escapeHtml(formatDateShort(a.created_at)) : "—";
      return `
        <div class="customer-row" style="align-items:center;">
          <div style="font-weight:800;">${escapeHtml(a.artifact_type)}</div>
          <div class="subtle">v${escapeHtml(String(a.version))} • ${created}</div>
          <div style="text-align:right;">
            <button type="button"
              class="btn-primary"
              data-open-artifact="1"
              data-artifact-type="${escapeHtml(a.artifact_type)}"
              data-artifact-version="${escapeHtml(String(a.version))}">
              Open
            </button>
          </div>
        </div>
      `;
    }).join("");

    ordersArtifactsList.innerHTML = items;
  }

  async function openArtifactSignedUrl(artifactType, version) {
    if (!selectedOrderId) return;

    const { data, error } = await supabaseClient.rpc("get_order_artifact_signed_url", {
      p_order_id: selectedOrderId,
      p_artifact_type: artifactType,
      p_version: version,
    });

    if (error) {
      setMsg("Signed URL failed: " + error.message);
      return;
    }

    const url = typeof data === "string" ? data : (data?.url || data?.signed_url || null);
    if (!url) {
      setMsg("Signed URL returned no url.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ---------------------------------------------------------
  // Payment actions (admin-only)
  // ---------------------------------------------------------
  async function setPaymentStatus(newStatus) {
    if (!selectedOrderId) return;
    if (!isAdminNow()) { setMsg("Not allowed."); return; }

    setMsg("Updating payment…");

    const { error } = await supabaseClient
      .from("orders")
      .update({ payment_status: newStatus })
      .eq("id", selectedOrderId);

    if (error) { setMsg("Update payment failed: " + error.message); return; }

    setMsg(newStatus === "paid" ? "Payment marked as PAID ✅" : "Order COMPED ✅");
    await openOrder(selectedOrderId);
  }

  // ---------------------------------------------------------
  // Generate pack
  // ---------------------------------------------------------
  async function generatePack() {
    if (!selectedOrderId) return;

    if (!canGeneratePackNow()) {
      setMsg("Not allowed.");
      return;
    }

    if (typeof window.exactGeneratePack !== "function") {
      setMsg("Missing window.exactGeneratePack(orderId).");
      return;
    }

    const btn = ordersGeneratePackBtn;
    const prevHtml = btn?.innerHTML || "Generate Pack";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="margin-right:8px;"></span>Generating…`;
    }
    setMsg("Generating pack…");

try {
  const result = await window.exactGeneratePack(selectedOrderId);

  // Re-open order so status/title/meta refresh (draft -> confirmed)
  await openOrder(selectedOrderId);

  const v = result?.version ?? result?.pack_version ?? null;

setMsg(v ? `Pack generated (v${v}).` : "Pack generated.");

// Hide button after success
if (btn) btn.style.display = "none";

    } catch (e) {
      // Handle 402 cleanly (payment required)
      const msg = String(e?.message || e);
      setMsg(msg.includes("402") ? "Payment required (admin: Mark Paid or Comp)." : ("Generate pack failed: " + msg));

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    }
  }

    async function mountStripePaymentForOrder(orderId) {
    if (!ordersPayMsg || !ordersPayBtn || !stripePaymentEl || !ordersPayPanel) return;

    const pk = state?.stripePublishableKey;
    if (!pk) { ordersPayMsg.textContent = "Stripe publishable key missing."; return; }
    if (!window.Stripe) { ordersPayMsg.textContent = "Stripe.js not loaded."; return; }

    ordersPayMsg.textContent = "Creating payment…";
    stripePaymentEl.style.display = "none";
    stripePaymentEl.innerHTML = "";

    const { data: sessData, error: sessErr } = await supabaseClient.auth.getSession();
if (sessErr) {
  ordersPayMsg.textContent = "Session error: " + sessErr.message;
  return;
}
const token = sessData?.session?.access_token;
if (!token) {
  ordersPayMsg.textContent = "No active session token (please log in again).";
  return;
}

const res = await supabaseClient.functions.invoke("stripe_create_payment_intent", {
  body: { order_id: orderId },
  headers: { Authorization: `Bearer ${token}` }
});


    if (res.error) {
      ordersPayMsg.textContent = "Payment init failed: " + (res.error.message || "");
      return;
    }

    const clientSecret = res.data?.client_secret;
    if (!clientSecret) {
      ordersPayMsg.textContent = "Missing client_secret.";
      return;
    }

    // Mount Payment Element
    const stripe = window.Stripe(pk);
    const elements = stripe.elements({ clientSecret });

    stripePaymentEl.style.display = "block";
    const paymentElement = elements.create("payment");
    paymentElement.mount(stripePaymentEl);

    ordersPayMsg.textContent = "";

    // Confirm payment on button click
    ordersPayBtn.onclick = async () => {
      ordersPayBtn.disabled = true;
      ordersPayMsg.textContent = "Processing…";

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href }
      });

      if (error) {
        ordersPayMsg.textContent = error.message || "Payment failed";
        ordersPayBtn.disabled = false;
        return;
      }

      ordersPayMsg.textContent = "Redirecting…";
    };

    // Cancel hides Stripe element
    if (ordersPayCancelBtn) {
      ordersPayCancelBtn.onclick = () => {
        stripePaymentEl.style.display = "none";
        stripePaymentEl.innerHTML = "";
        ordersPayMsg.textContent = "";
      };
    }
  }

  // ---------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------
  async function openOrder(orderId) {
    selectedOrderId = orderId;
    setMsg("");

    show(ordersListPanel, false);
    show(ordersDetailPanel, true);

    const isAdmin = isAdminNow();
    const canGeneratePack = canGeneratePackNow();

    // Base visibility
    show(ordersBatchSummary, canGeneratePack);
    show(ordersArtifactsList, isAdmin);

    // Buttons
    show(ordersMarkPaidBtn, isAdmin);
    show(ordersCompBtn, isAdmin);
    show(ordersGeneratePackBtn, canGeneratePack);

    // Hide section headers too (they're separate from the content divs)
    const batchHeaderEl = ordersBatchSummary?.previousElementSibling;
    if (batchHeaderEl) show(batchHeaderEl, canGeneratePack);

    const artifactsHeaderEl = ordersArtifactsList?.previousElementSibling;
    if (artifactsHeaderEl) show(artifactsHeaderEl, isAdmin);

    // Load order (includes payment_status)
    const { data: o, error } = await supabaseClient
      .from("orders")
      .select(`
        id,
        order_code,
        status,
        payment_status,
        created_at,
        dispatch_to,
        ship_to_name,
        ship_to_phone,
        ship_to_email,
        ship_to_address,
        ship_to_city,
        ship_to_country,
        lab_id
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error) { setMsg("Load order failed: " + error.message); return; }
    if (!o) { setMsg("Order not found."); return; }

    if (ordersDetailTitle) {
      ordersDetailTitle.textContent = `${o.order_code || "Order"} — ${o.status || ""}`;
    }
if (ordersDetailMeta) {
  const parts = [];
  parts.push(`Order ID: ${o.id}`);
  parts.push(`Status: ${o.status || "—"}`);
  parts.push(`Payment: ${o.payment_status || "unpaid"}`);
  if (o.dispatch_to) parts.push(`Dispatch: ${o.dispatch_to}`);
  if (o.lab_id) parts.push(`Lab: ${o.lab_id}`);
  ordersDetailMeta.textContent = parts.join(" | ");
}

    // ===== PAYMENT (Stripe) =====
if (ordersPayPanel) ordersPayPanel.style.display = "";
if (stripePaymentEl) { stripePaymentEl.style.display = "none"; stripePaymentEl.innerHTML = ""; }
if (ordersPayMsg) ordersPayMsg.textContent = "";

// Show Pay panel only if not already paid/comped
const ps = String(o.payment_status || "").toLowerCase();
if (ps === "paid" || ps === "comped") {
  if (ordersPayPanel) ordersPayPanel.style.display = "none";
} else {
  if (ordersPayMsg) ordersPayMsg.textContent = "Ready to take payment.";
  if (ordersPayBtn) ordersPayBtn.disabled = false;
  if (ordersPayBtn) ordersPayBtn.onclick = () => mountStripePaymentForOrder(o.id);
}


    // Reset generate button state on each open
    if (ordersGeneratePackBtn) {
      ordersGeneratePackBtn.style.display = canGeneratePack ? "" : "none";
      ordersGeneratePackBtn.disabled = false;
      ordersGeneratePackBtn.textContent = "Generate Pack";
    }

    // Disable generate unless paid/comped
    const pay = String(o.payment_status || "unpaid").toLowerCase();
    const isPaidLike = (pay === "paid" || pay === "comped");
    // Detect existing pack (any batch exists)
const { data: existingBatches } = await supabaseClient
  .from("order_batches")
  .select("id")
  .eq("order_id", orderId)
  .limit(1);

const hasPack = Array.isArray(existingBatches) && existingBatches.length > 0;

  if (ordersGeneratePackBtn) {
  if (hasPack) {
    ordersGeneratePackBtn.style.display = "none";
  } else if (canGeneratePack && !isPaidLike) {
    ordersGeneratePackBtn.disabled = true;
    ordersGeneratePackBtn.textContent = "Generate Pack (unpaid)";
  }
}


    // Load batch summary (visible for admin+agent)
    if (canGeneratePack) {
      await loadBatchSummaryFromBatches(orderId);
    } else if (ordersBatchSummary) {
      ordersBatchSummary.innerHTML = "";
    }

    // Artifacts admin-only
    if (isAdmin) {
      await loadArtifacts(orderId);
    } else if (ordersArtifactsList) {
      ordersArtifactsList.innerHTML = "";
    }
  }

  // ---------------------------------------------------------
  // Bind
  // ---------------------------------------------------------
  function bindOnce() {
    if (ordersList && ordersList.dataset.bound !== "1") {
      ordersList.addEventListener("click", (e) => {
        const row = e.target.closest("[data-order-id]");
        if (!row) return;
        const id = row.getAttribute("data-order-id");
        if (!id) return;
        openOrder(id);
      });
      ordersList.dataset.bound = "1";
    }

    if (ordersShowAllBtn && ordersShowAllBtn.dataset.bound !== "1") {
      ordersShowAllBtn.addEventListener("click", () => loadOrders({ mode: "all" }));
      ordersShowAllBtn.dataset.bound = "1";
    }

    if (ordersSearchBtn && ordersSearchBtn.dataset.bound !== "1") {
      ordersSearchBtn.addEventListener("click", () => loadOrders({ mode: "search" }));
      ordersSearchBtn.dataset.bound = "1";
    }

    if (ordersBackBtn && ordersBackBtn.dataset.bound !== "1") {
      ordersBackBtn.addEventListener("click", () => {
        selectedOrderId = null;
        show(ordersDetailPanel, false);
        show(ordersListPanel, true);
        setMsg("");
      });
      ordersBackBtn.dataset.bound = "1";
    }

    if (ordersRefreshBtn && ordersRefreshBtn.dataset.bound !== "1") {
      ordersRefreshBtn.addEventListener("click", () => {
        if (selectedOrderId) openOrder(selectedOrderId);
      });
      ordersRefreshBtn.dataset.bound = "1";
    }

    if (ordersGeneratePackBtn && ordersGeneratePackBtn.dataset.bound !== "1") {
      ordersGeneratePackBtn.addEventListener("click", generatePack);
      ordersGeneratePackBtn.dataset.bound = "1";
    }

    if (ordersMarkPaidBtn && ordersMarkPaidBtn.dataset.bound !== "1") {
      ordersMarkPaidBtn.addEventListener("click", async () => setPaymentStatus("paid"));
      ordersMarkPaidBtn.dataset.bound = "1";
    }

    if (ordersCompBtn && ordersCompBtn.dataset.bound !== "1") {
      ordersCompBtn.addEventListener("click", async () => setPaymentStatus("comped"));
      ordersCompBtn.dataset.bound = "1";
    }

    if (ordersArtifactsList && ordersArtifactsList.dataset.bound !== "1") {
      ordersArtifactsList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-open-artifact='1']");
        if (!btn) return;
        const t = btn.getAttribute("data-artifact-type");
        const vStr = btn.getAttribute("data-artifact-version");
        const v = Number(vStr);
        if (!t || !Number.isFinite(v)) return;
        openArtifactSignedUrl(t, v);
      });
      ordersArtifactsList.dataset.bound = "1";
    }

    if (ordersCreateBtn && ordersCreateBtn.dataset.bound !== "1") {
      ordersCreateBtn.addEventListener("click", async () => {
        setMsg("");

        const profile = state?.currentProfile;
        const agent_id = profile?.agent_id;

        if (!agent_id) { setMsg("No agent_id in profile."); return; }

        const { data: customers, error: cErr } = await supabaseClient
          .from("customers")
          .select("id, first_name, last_name, email, phone, shipping_address, shipping_city, shipping_country")
          .order("created_at", { ascending: false });

        if (cErr) { setMsg("Load customers failed: " + cErr.message); return; }

        const { data: agentRow, error: aErr } = await supabaseClient
          .from("agents")
          .select("id, name, email, phone, shipping_address, shipping_city, shipping_country")
          .eq("id", agent_id)
          .maybeSingle();

        if (aErr) { setMsg("Load agent failed: " + aErr.message); return; }

        renderCreateOrderModal({
          customers,
          agent: agentRow,
          onCancel: () => {},
          onSubmit: async ({
            customer_id,
            dispatch_to,
            ship_to_name,
            ship_to_phone,
            ship_to_email,
            ship_to_address,
            ship_to_city,
            ship_to_country,
          }) => {
            setMsg("Creating order…");

            const { data: orderRow, error: oErr } = await supabaseClient
              .from("orders")
              .insert([{
                agent_id,
                customer_id,
                dispatch_to,
                ship_to_name,
                ship_to_phone,
                ship_to_email,
                ship_to_address,
                ship_to_city,
                ship_to_country,
              }])
              .select("id")
              .single();

            if (oErr) { setMsg("Create order failed: " + oErr.message); return; }

            const order_id = orderRow.id;

            const { error: iErr } = await supabaseClient
              .from("order_items")
              .insert([{
                order_id,
                product_id: "29c9e7e2-c728-4860-8f64-175fbf230a7c",
                product_code_snapshot: "PRD0001",
                product_name_snapshot: "EXACT Personalized Skincare Set",
                product_kind_snapshot: "dynamic",
              }]);

            if (iErr) { setMsg("Add item failed: " + iErr.message); return; }

            await loadOrders({ mode: "all" });
            await openOrder(order_id);

            setMsg("Draft order created ✅");
          },
        });
      });

      ordersCreateBtn.dataset.bound = "1";
    }
  }

  bindOnce();

  return {
    reset: resetScreen,
    enter: async () => {
      resetScreen();
      setMsg("Use Search or Show all.");
    },
  };
}
