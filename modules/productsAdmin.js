// modules/productsAdmin.js
export function initProductsAdmin({ supabaseClient, ui, helpers }) {
  const { show, escapeHtml, confirmExact } = helpers;

  const {
    paViewBtn, paClearBtn, paMsg,
    paListPanel, paList,
    paEditPanel,
    paProductName, paEdgeFn, paSubject, paBody,
    paSendEmail, paIncludeLinks, paIncludeAttachments,
    paSaveBtn, paCancelBtn
  } = ui;

  let selectedProduct = null; // {id, product_code, name}

  const setMsg = (t) => { if (paMsg) paMsg.textContent = t || ""; };

  function reset() {
    setMsg("");
    selectedProduct = null;

    show(paListPanel, false);
    show(paEditPanel, false);

    if (paProductName) paProductName.value = "";
    if (paEdgeFn) paEdgeFn.value = "";
    if (paSubject) paSubject.value = "";
    if (paBody) paBody.value = "";
    if (paSendEmail) paSendEmail.checked = true;
    if (paIncludeLinks) paIncludeLinks.checked = true;
    if (paIncludeAttachments) paIncludeAttachments.checked = false;

    if (paClearBtn) paClearBtn.style.display = "none";
  }

  async function loadProductsList() {
    setMsg("Loading products…");

    const { data: products, error } = await supabaseClient
      .from("products")
      .select("id, product_code, name")
      .order("created_at", { ascending: false });

    if (error) { setMsg("Load failed: " + error.message); return; }

    const rows = products || [];
    if (!paList) return;

    paList.innerHTML = rows.map(p => {
      const label = `${escapeHtml(p.product_code || "")} — ${escapeHtml(p.name || "")}`.trim();
      return `
        <div class="customer-row" data-id="${p.id}">
          <div style="font-weight:700;">${label || escapeHtml(p.id)}</div>
          <div class="subtle" style="margin-top:4px;">Click to edit execution settings</div>
        </div>
      `;
    }).join("");

    paList.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.getAttribute("data-id");
        const p = rows.find(x => x.id === id);
        if (!p) return;
        await openEditor(p);
      });
    });

    setMsg(`Loaded ${rows.length} products.`);
  }

  async function openEditor(product) {
    selectedProduct = product;

    if (paProductName) paProductName.value =
      `${product.product_code || ""} — ${product.name || ""}`.trim();

    // Load existing settings (admin-only RLS)
    setMsg("Loading execution settings…");

    const { data: s, error } = await supabaseClient
      .from("product_execution_settings")
      .select("*")
      .eq("product_id", product.id)
      .maybeSingle();

    if (error) { setMsg("Load settings failed: " + error.message); return; }

    if (paEdgeFn) paEdgeFn.value = s?.edge_function_name || "";
    if (paSubject) paSubject.value = s?.lab_email_subject || "";
    if (paBody) paBody.value = s?.lab_email_body_md || "";

    if (paSendEmail) paSendEmail.checked = s?.send_lab_email ?? true;
    if (paIncludeLinks) paIncludeLinks.checked = s?.include_signed_links ?? true;
    if (paIncludeAttachments) paIncludeAttachments.checked = s?.include_attachments ?? false;

    show(paListPanel, false);
    show(paEditPanel, true);

    if (paClearBtn) paClearBtn.style.display = "inline-block";
    setMsg("");
  }

  async function saveSettings() {
    if (!selectedProduct?.id) { setMsg("No product selected."); return; }

    const edgeFn = String(paEdgeFn?.value || "").trim();
    const subj = String(paSubject?.value || "").trim();
    const body = String(paBody?.value || "").trim();

    if (!edgeFn) { setMsg("Edge function name is required."); return; }
    if (!subj) { setMsg("Email subject is required."); return; }
    if (!body) { setMsg("Email body is required."); return; }

    const payload = {
      product_id: selectedProduct.id,
      edge_function_name: edgeFn,
      lab_email_subject: subj,
      lab_email_body_md: body,
      send_lab_email: !!paSendEmail?.checked,
      include_signed_links: !!paIncludeLinks?.checked,
      include_attachments: !!paIncludeAttachments?.checked,
      settings: {}
    };

    const ok = await confirmExact("Save execution settings for this product?");
    if (!ok) return;

    setMsg("Saving…");

    const { error } = await supabaseClient
      .from("product_execution_settings")
      .upsert(payload, { onConflict: "product_id" });

    if (error) { setMsg("Save failed: " + error.message); return; }

    setMsg("Saved ✅");
  }

  // Wire buttons (bind once)
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
      // back to list
      show(paEditPanel, false);
      show(paListPanel, true);
      setMsg("");
    });
    paCancelBtn.dataset.bound = "1";
  }

  return { reset };
}
