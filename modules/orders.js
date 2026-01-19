// modules/orders.js
export function initOrdersManagement({ supabaseClient, ui, helpers, state }) {
  const {
    show,
    escapeHtml,
    formatDateShort,
  } = helpers;

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

  let selectedOrderId = null;

 const isAdmin = String(state?.currentProfile?.role || "").toLowerCase() === "admin";

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

  // When customer changes: if dispatch_to=customer, autofill
  $cust?.addEventListener("change", () => {
    if (String($dispatch.value) === "customer") applyDispatchDefaults();
  });

  // When dispatch changes: autofill based on selection
  $dispatch?.addEventListener("change", () => applyDispatchDefaults());

  // Default: pick first customer if exists (optional)
  if ((customers || []).length === 1) {
    $cust.value = customers[0].id;
  }
  // Fill initial values (customer by default)
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
      ship_to_country
    });
  };
}


  function renderOrderRow(o) {
    const code = escapeHtml(o.order_code || o.id);
    const status = escapeHtml(o.status || "—");
    const created = o.created_at ? escapeHtml(formatDateShort(o.created_at)) : "—";

    

    // customer name may vary; use safe fallback
    const cust = o.customer?.first_name || o.customer?.last_name
      ? `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim()
      : "—";

    return `
      <div class="customer-row" data-order-id="${escapeHtml(o.id)}" style="cursor:pointer;">
        <div style="font-weight:800;">${code}</div>
        <div class="subtle" style="margin-top:4px;">
          Status: ${status} • Created: ${created} • Customer: ${escapeHtml(cust)}
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

  async function openOrder(orderId) {
    selectedOrderId = orderId;
    setMsg("");

    show(ordersListPanel, false);
    show(ordersDetailPanel, true);
    
    // Visibility rules:
    // - Admin: can generate pack, see batch summary, see artifacts
    // - Agent: can generate pack, see batch summary, NOT artifacts
    const canSeeArtifacts = isAdmin;

    // Generate pack button: visible for both admin + agent
    show(ordersGeneratePackBtn, true);

    // Batch summary block: visible for both admin + agent
    // (hide/show the WHOLE section wrapper, not just the inner div)
    if (ordersBatchSummary?.parentElement) show(ordersBatchSummary.parentElement, true);
    show(ordersBatchSummary, true);

    // Artifacts block: admin only
    if (ordersArtifactsList?.parentElement) show(ordersArtifactsList.parentElement, canSeeArtifacts);
    show(ordersArtifactsList, canSeeArtifacts);

    // If agent, also clear any old artifacts HTML so headers don't look "empty"
    if (!canSeeArtifacts && ordersArtifactsList) ordersArtifactsList.innerHTML = "";



    // Load order core fields (we only display some)
    const { data: o, error } = await supabaseClient
      .from("orders")
      .select(`
        id,
        order_code,
        status,
        created_at,
        dispatch_to,
        ship_to_name,
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
      if (o.dispatch_to) parts.push(`Dispatch: ${o.dispatch_to}`);
      if (o.lab_id) parts.push(`Lab: ${o.lab_id}`);
      if (o.ship_to_name) parts.push(`Ship-to: ${o.ship_to_name}`);
      if (o.ship_to_city) parts.push(`City: ${o.ship_to_city}`);
      if (o.ship_to_country) parts.push(`Country: ${o.ship_to_country}`);
      ordersDetailMeta.textContent = parts.join(" | ");
    }

  if (isAdmin) {
    await loadBatchSummaryFromLatestFormulationJson(orderId);
    if (isAdmin) await loadArtifacts(orderId);

}

}
  async function loadBatchSummaryFromLatestFormulationJson(orderId) {
    if (!ordersBatchSummary) return;
    ordersBatchSummary.innerHTML = `<div class="subtle">Loading…</div>`;

    // We use the latest formulation_json artifact (format=json) and read content_json.formulas[]
    const { data, error } = await supabaseClient
      .from("order_artifacts")
      .select("artifact_type, format, version, content_json, created_at")
      .eq("order_id", orderId)
      .eq("artifact_type", "formulation_json")
      .order("version", { ascending: false })
      .limit(1);

    if (error) { setMsg("Load formulation_json failed: " + error.message); return; }

    const row = (data || [])[0];
    if (!row || !row.content_json) {
      ordersBatchSummary.innerHTML = `<div class="subtle">No formulation_json yet (generate pack to create).</div>`;
      return;
    }

    const cj = row.content_json;
    const formulas = Array.isArray(cj.formulas) ? cj.formulas : [];

    if (!formulas.length) {
      ordersBatchSummary.innerHTML = `<div class="subtle">formulation_json has no formulas[] (unexpected).</div>`;
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

    const body = formulas.map(f => {
      const fk = escapeHtml(f.formula_key || "—");
      const batch = escapeHtml(f.batch?.exact_batch_code || "—");
      const fill = escapeHtml(String(f.packaging?.fill_volume_ml ?? "—"));
      const proc = escapeHtml(f.manufacturing?.process_profile || "—");

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

    // Render with per-row "Open" button using get_order_artifact_signed_url(order_id, artifact_type, version)
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
      p_version: version
    });

    if (error) {
      setMsg("Signed URL failed: " + error.message);
      return;
    }

    // data should be a URL string (or JSON containing it). We handle both safely.
    const url = typeof data === "string" ? data : (data?.url || data?.signed_url || null);
    if (!url) {
      setMsg("Signed URL returned no url.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function generatePack() {
    if (!selectedOrderId) return;

    if (typeof window.exactGeneratePack !== "function") {
      setMsg("Missing window.exactGeneratePack(orderId).");
      return;
    }

    setMsg("Generating pack…");
    try {
      const result = await window.exactGeneratePack(selectedOrderId);

      // Refresh panels
      await loadBatchSummaryFromLatestFormulationJson(selectedOrderId);
      if (isAdmin) await loadArtifacts(selectedOrderId);

      const v = result?.version ?? result?.pack_version ?? null;
      setMsg(v ? `Pack generated (v${v}).` : "Pack generated.");
    } catch (e) {
      setMsg("Generate pack failed: " + (e?.message || String(e)));
    }
  }

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

const profile = state?.currentProfile; // getter returns the live profile object
const agent_id = profile?.agent_id;

    if (!agent_id) { setMsg("No agent_id in profile."); return; }

    // Load customers (RLS already restricts to agent)
    const { data: customers, error: cErr } = await supabaseClient
.from("customers")
.select("id, first_name, last_name, email, phone, shipping_address, shipping_city, shipping_country")

      .order("created_at", { ascending: false });

    if (cErr) { setMsg("Load customers failed: " + cErr.message); return; }

    // Load agent (for dispatch_to = agent)
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
    ship_to_country
  }) => {


        setMsg("Creating order…");

        // A) create draft order (lab trigger applies automatically)
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
  ship_to_country
}])

          .select("id")
          .single();

        if (oErr) { setMsg("Create order failed: " + oErr.message); return; }

        const order_id = orderRow.id;

        // B) add PRD0001 trio item
        const { error: iErr } = await supabaseClient
          .from("order_items")
          .insert([{
            order_id,
            product_id: "29c9e7e2-c728-4860-8f64-175fbf230a7c",
            product_code_snapshot: "PRD0001",
            product_name_snapshot: "EXACT Personalized Skincare Set",
            product_kind_snapshot: "dynamic"
          }]);

        if (iErr) { setMsg("Add item failed: " + iErr.message); return; }

        // C) open detail
    await loadOrders({ mode: "all" });
    await openOrder(order_id);

setMsg("Draft order created ✅");
  
    
      }
    });
  });

  ordersCreateBtn.dataset.bound = "1";
}

  }

  bindOnce();

  return {
    reset: resetScreen,
    enter: async () => {
      // Force agent_id to current agent (agreed)
      // (We’re not creating orders yet in this step; this is here as a guardrail for later.)
      resetScreen();
      setMsg("Use Search or Show all.");
    }
  };
}
