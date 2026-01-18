// modules/productsAdmin.js
// Admin-only editor for:
// 1) public.products (product_kind, currency_code, unit_price_aed, is_active)
// 2) public.product_execution_settings (ONLY when product_kind === 'dynamic')
//
// Assumes UI element IDs exist (from your index.html edits):
// paViewBtn, paClearBtn, paMsg, paListPanel, paList,
// paEditPanel, paProductName,
// paKind, paCurrency, paUnitPrice, paIsActive,
// paDynamicBlock, paStaticNote,
// paEdgeFn, paSubject, paBody,
// paSendEmail, paIncludeLinks, paIncludeAttachments,
// paSaveBtn, paCancelBtn

export function initProductsAdmin({ supabaseClient, ui, helpers }) {
  const { show, escapeHtml, confirmExact } = helpers;

  const {
    paViewBtn, paClearBtn, paMsg,
    paListPanel, paList,
    paEditPanel,
    paProductName,

    paKind, paCurrency, paUnitPrice, paIsActive,
    paDynamicBlock, paStaticNote,

    paEdgeFn, paSubject, paBody,
    paSendEmail, paIncludeLinks, paIncludeAttachments,

    paSaveBtn, paCancelBtn
  } = ui;

  let productsCache = [];      // [{id, product_code, name, product_kind, currency_code, unit_price_aed, is_active}]
  let selectedProduct = null;  // product object from cache

  const setMsg = (t) => { if (paMsg) paMsg.textContent = t || ""; };

  function safeNumOrNull(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    // accept "123" "123.45"
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    // keep 2dp for display in DB numeric(12,2) is fine
    return Math.round(n * 100) / 100;
  }

  function currentKind() {
    return String(paKind?.value || "static").trim().toLowerCase();
  }

  function toggleDynamicUI(kind) {
    const isDyn = (kind === "dynamic");
    show(paDynamicBlock, isDyn);
    show(paStaticNote, !isDyn);
  }

  function clearEditorFields() {
    if (paProductName) paProductName.value = "";

    if (paKind) paKind.value = "static";
    if (paCurrency) paCurrency.value = "AED";
    if (paUnitPrice) paUnitPrice.value = "";
    if (paIsActive) paIsActive.checked = true;

    if (paEdgeFn) paEdgeFn.value = "";
    if (paSubject) paSubject.value = "";
    if (paBody) paBody.value = "";

    if (paSendEmail) paSendEmail.checked = true;
    if (paIncludeLinks) paIncludeLinks.checked = true;
    if (paIncludeAttachments) paIncludeAttachments.checked = false;

    toggleDynamicUI("static");
  }

  function reset() {
    setMsg("");
    selectedProduct = null;
    productsCache = [];

    show(paListPanel, false);
    show(paEditPanel, false);

    clearEditorFields();

    if (paClearBtn) paClearBtn.style.display = "none";
  }

  async function loadProductsList() {
    setMsg("Loading products…");

    const { data, error } = await supabaseClient
      .from("products")
      .select("id, product_code, name, product_kind, currency_code, unit_price_aed, is_active")
      .order("created_at", { ascending: false });

    if (error) { setMsg("Load failed: " + error.message); return; }

    productsCache = data || [];

    if (!paList) return;

    paList.innerHTML = productsCache.map(p => {
      const label = `${escapeHtml(p.product_code || "")} — ${escapeHtml(p.name || "")}`.trim() || escapeHtml(p.id);
      const kind = escapeHtml(p.product_kind || "static");
      const cur = escapeHtml(p.currency_code || "AED");
      const price = (p.unit_price_aed === null || p.unit_price_aed === undefined) ? "" : escapeHtml(String(p.unit_price_aed));
      const active = (p.is_active === false) ? "inactive" : "active";

      const meta = `${kind} | ${cur} ${price}`.trim();
      return `
        <div class="customer-row" data-id="${p.id}">
          <div style="font-weight:700;">${label}</div>
          <div class="subtle" style="margin-top:4px;">${meta} | ${active}</div>
          <div class="subtle" style="margin-top:4px;">Click to edit</div>
        </div>
      `;
    }).join("");

    paList.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.getAttribute("data-id");
        const p = productsCache.find(x => x.id === id);
        if (!p) return;
        await openEditor(p);
      });
    });

    setMsg(`Loaded ${productsCache.length} products.`);
  }

async function openEditor(product) {
  selectedProduct = product;
  setMsg("");

  show(paListPanel, false);
  show(paEditPanel, true);
  if (paClearBtn) paClearBtn.style.display = "inline-block";

  // ✅ Always re-fetch the latest product row from DB (source of truth)
  const { data: p, error: pErr } = await supabaseClient
    .from("products")
    .select("id, product_code, name, product_kind, currency_code, unit_price_aed, is_active")
    .eq("id", product.id)
    .maybeSingle();

  if (pErr) { setMsg("Load product failed: " + pErr.message); return; }
  if (!p) { setMsg("Product not found."); return; }

  // Update local references
  selectedProduct = p;

  // ---- Populate product master fields ----
  if (paProductName) {
    paProductName.value = `${p.product_code || ""} — ${p.name || ""}`.trim();
  }

  const kind = String(p.product_kind || "static").toLowerCase();
  if (paKind) paKind.value = kind;

  if (paCurrency) paCurrency.value = p.currency_code || "AED";
  if (paUnitPrice) paUnitPrice.value = (p.unit_price_aed === null || p.unit_price_aed === undefined)
    ? ""
    : String(p.unit_price_aed);

  if (paIsActive) paIsActive.checked = (p.is_active !== false);

  toggleDynamicUI(kind);

  // Bind kind toggle once
  if (paKind && paKind.dataset.bound !== "1") {
    paKind.addEventListener("change", () => {
      toggleDynamicUI(currentKind());
    });
    paKind.dataset.bound = "1";
  }

  // If static: clear dynamic fields and stop
  if (kind !== "dynamic") {
    if (paEdgeFn) paEdgeFn.value = "";
    if (paSubject) paSubject.value = "";
    if (paBody) paBody.value = "";
    if (paSendEmail) paSendEmail.checked = true;
    if (paIncludeLinks) paIncludeLinks.checked = true;
    if (paIncludeAttachments) paIncludeAttachments.checked = false;
    return;
  }

  // ---- Load execution settings ----
  setMsg("Loading execution settings…");

  const { data: s, error: sErr } = await supabaseClient
    .from("product_execution_settings")
    .select("*")
    .eq("product_id", p.id)
    .maybeSingle();

  if (sErr) { setMsg("Load settings failed: " + sErr.message); return; }

  if (paEdgeFn) paEdgeFn.value = s?.edge_function_name || "";
  if (paSubject) paSubject.value = s?.lab_email_subject || "";
  if (paBody) paBody.value = s?.lab_email_body_md || "";

  if (paSendEmail) paSendEmail.checked = s?.send_lab_email ?? true;
  if (paIncludeLinks) paIncludeLinks.checked = s?.include_signed_links ?? true;
  if (paIncludeAttachments) paIncludeAttachments.checked = s?.include_attachments ?? false;

  setMsg("");
}


  async function saveSettings() {
    if (!selectedProduct?.id) { setMsg("No product selected."); return; }

    const kind = currentKind();
    if (kind !== "static" && kind !== "dynamic") {
      setMsg("Invalid product_kind. Must be static or dynamic.");
      return;
    }

    const currency = String(paCurrency?.value || "AED").trim().toUpperCase() || "AED";
    const price = safeNumOrNull(paUnitPrice?.value);
    const isActive = !!paIsActive?.checked;

    // Confirm
    const ok = await confirmExact("Save product settings?");
    if (!ok) return;

    setMsg("Saving product…");

    // 1) Update products table (master fields)
    const { error: pErr } = await supabaseClient
      .from("products")
      .update({
        product_kind: kind,
        currency_code: currency,
        unit_price_aed: price,
        is_active: isActive
      })
      .eq("id", selectedProduct.id);

    if (pErr) { setMsg("Save product failed: " + pErr.message); return; }

    // Update local cache + selectedProduct for consistency
    selectedProduct.product_kind = kind;
    selectedProduct.currency_code = currency;
    selectedProduct.unit_price_aed = price;
    selectedProduct.is_active = isActive;

    // 2) If static: stop here (no execution settings required)
    if (kind !== "dynamic") {
      setMsg("Saved ✅ (static product — no execution settings)");
      toggleDynamicUI("static");
      return;
    }

    // 3) Dynamic: validate execution settings fields
    const edgeFn = String(paEdgeFn?.value || "").trim();
    const subj = String(paSubject?.value || "").trim();
    const body = String(paBody?.value || "").trim();

    if (!edgeFn) { setMsg("Edge function name is required for dynamic products."); return; }
    if (!subj) { setMsg("Email subject is required for dynamic products."); return; }
    if (!body) { setMsg("Email body is required for dynamic products."); return; }

    const execPayload = {
      product_id: selectedProduct.id,
      edge_function_name: edgeFn,
      lab_email_subject: subj,
      lab_email_body_md: body,
      send_lab_email: !!paSendEmail?.checked,
      include_signed_links: !!paIncludeLinks?.checked,
      include_attachments: !!paIncludeAttachments?.checked,
      settings: {}
    };

    setMsg("Saving execution settings…");

    const { error: eErr } = await supabaseClient
      .from("product_execution_settings")
      .upsert(execPayload, { onConflict: "product_id" });

    if (eErr) { setMsg("Save execution settings failed: " + eErr.message); return; }

    setMsg("Saved ✅");
  }

  // Bind buttons once
  if (paViewBtn && paViewBtn.dataset.bound !== "1") {
    paViewBtn.addEventListener("click", async () => {
      reset();
      show(paListPanel, true);
      await loadProductsList();
      if (paClearBtn) paClearBtn.style.display = "inline-block";
    });
    paViewBtn.dataset.bound = "1";
  }

  if (paClearBtn && paClearBtn.dataset.bound !== "1") {
    paClearBtn.addEventListener("click", () => reset());
    paClearBtn.dataset.bound = "1";
  }

  if (paSaveBtn && paSaveBtn.dataset.bound !== "1") {
    paSaveBtn.addEventListener("click", saveSettings);
    paSaveBtn.dataset.bound = "1";
  }

  if (paCancelBtn && paCancelBtn.dataset.bound !== "1") {
    paCancelBtn.addEventListener("click", () => {
      show(paEditPanel, false);
      show(paListPanel, true);
      setMsg("");
    });
    paCancelBtn.dataset.bound = "1";
  }

  return { reset };
}
