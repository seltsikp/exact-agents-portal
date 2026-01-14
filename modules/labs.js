// modules/labs.js
export function initLabManagement({ supabaseClient, ui, helpers }) {
  const { show, confirmExact } = helpers;

  const {
    lmViewBtn,
    lmAddBtn,
    lmClearBtn,
    labMsg,
    lmViewPanel,
    lmAddPanel,
    labList,

    lmName,
    lmEmail,
    lmOrdersEmail,
    lmPhone,
    lmAddress,
    lmShipping,
    lmSaveBtn
  } = ui;

  const setLabMsg = (t) => { if (labMsg) labMsg.textContent = t || ""; };

  let labsById = {};
  let editingLabId = null;

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clearLabForm() {
    if (lmName) lmName.value = "";
    if (lmEmail) lmEmail.value = "";
    if (lmOrdersEmail) lmOrdersEmail.value = "";
    if (lmPhone) lmPhone.value = "";
    if (lmAddress) lmAddress.value = "";
    if (lmShipping) lmShipping.value = "";
  }

  async function loadLabs() {
    if (!labList) return;

    setLabMsg("Loading labs…");
    labList.innerHTML = "";
    labsById = {};

    const { data, error } = await supabaseClient
      .from("labs")
      .select("id, lab_code, name, orders_email, admin_email, phone, address, shipping_address, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setLabMsg("Load error: " + error.message);
      labList.innerHTML = `<p class="subtle" style="margin:0;">Could not load labs.</p>`;
      return;
    }

    const rows = data || [];
    rows.forEach(r => { labsById[r.id] = r; });

    if (rows.length === 0) {
      setLabMsg("No labs yet. Click “Add lab”.");
      labList.innerHTML = `<p class="subtle" style="margin:0;">No labs yet. Click “Add lab”.</p>`;
      return;
    }

    setLabMsg(`Found ${rows.length} lab${rows.length === 1 ? "" : "s"}.`);

    labList.innerHTML = rows.map(r => `
      <div class="customer-row" data-lab-id="${escapeHtml(r.id)}">
        <div class="customer-main">
          <div class="name">${escapeHtml(r.name || "")}</div>
          <div class="meta">
            <span style="opacity:.75;"><b>${escapeHtml(r.lab_code || "")}</b></span>
            <span class="customer-dot">•</span>
            <span><b>Orders:</b> ${escapeHtml(r.orders_email || "")}</span>
            <span class="customer-dot">•</span>
            ${r.admin_email
              ? `<span>Admin: ${escapeHtml(r.admin_email)}</span>`
              : `<span style="opacity:.65;">No admin email</span>`}
            <span class="customer-dot">•</span>
            ${r.phone
              ? `<span>${escapeHtml(r.phone)}</span>`
              : `<span style="opacity:.65;">No phone</span>`}
          </div>
        </div>

        <div class="customer-context">
          <span class="pill-soft">Created: ${escapeHtml(new Date(r.created_at).toLocaleDateString())}</span>
        </div>

        <div class="customer-actions">
          <button class="btn btn-soft action-pill edit-pill" type="button" data-action="edit">Edit</button>
          <button class="btn action-pill delete-pill" type="button" data-action="delete">Delete</button>
        </div>
      </div>
    `).join("");
  }

  function resetLabsScreen() {
    show(lmViewPanel, false);
    show(lmAddPanel, false);
    show(lmClearBtn, false);
    setLabMsg("");
    clearLabForm();
    editingLabId = null;
  }

  async function showViewLabsPanel() {
    show(lmViewPanel, true);
    show(lmAddPanel, false);
    show(lmClearBtn, true);
    await loadLabs();
  }

  function showAddLabPanel() {
    show(lmViewPanel, false);
    show(lmAddPanel, true);
    show(lmClearBtn, true);

    if (editingLabId) setLabMsg("Editing lab — update fields and click Save lab.");
    else setLabMsg("Add a lab and click Save.");

    if (lmName) lmName.focus();
  }

  // Buttons
  if (lmViewBtn) lmViewBtn.addEventListener("click", showViewLabsPanel);

  if (lmAddBtn) lmAddBtn.addEventListener("click", () => {
    editingLabId = null;
    clearLabForm();
    showAddLabPanel();
  });

  if (lmClearBtn) lmClearBtn.addEventListener("click", resetLabsScreen);

  // Save (insert/update)
  if (lmSaveBtn) {
    lmSaveBtn.addEventListener("click", async () => {
      setLabMsg("");

      const name = (lmName?.value || "").trim();
      if (!name) { setLabMsg("Lab name is required."); return; }

      const orders_email = (lmOrdersEmail?.value || "").trim();
      if (!orders_email) { setLabMsg("Orders / formulations email is required."); return; }

      const admin_email = (lmEmail?.value || "").trim() || null;
      const phone = (lmPhone?.value || "").trim() || null;
      const address = (lmAddress?.value || "").trim() || null;
      const shipping_address = (lmShipping?.value || "").trim() || null;

      // UPDATE
      if (editingLabId) {
        const { data, error } = await supabaseClient
          .from("labs")
          .update({ name, orders_email, admin_email, phone, address, shipping_address })
          .eq("id", editingLabId)
          .select("id");

        if (error) { setLabMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setLabMsg("Update blocked (RLS) — no rows updated."); return; }

        setLabMsg("Updated ✅");
        editingLabId = null;
        clearLabForm();
        await showViewLabsPanel();
        return;
      }

      // INSERT
      const { error } = await supabaseClient
        .from("labs")
        .insert([{ name, orders_email, admin_email, phone, address, shipping_address }]);

      if (error) { setLabMsg("Insert error: " + error.message); return; }

      setLabMsg("Lab added ✅");
      clearLabForm();
      await showViewLabsPanel();
    });
  }

  // Edit/Delete delegation
  if (labList) {
    labList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const row = e.target.closest(".customer-row");
      if (!row) return;

      const labId = row.getAttribute("data-lab-id");
      const r = labsById[labId];
      if (!r) return;

      if (action === "edit") {
        editingLabId = r.id;

        if (lmName) lmName.value = r.name || "";
        if (lmOrdersEmail) lmOrdersEmail.value = r.orders_email || "";
        if (lmEmail) lmEmail.value = r.admin_email || "";
        if (lmPhone) lmPhone.value = r.phone || "";
        if (lmAddress) lmAddress.value = r.address || "";
        if (lmShipping) lmShipping.value = r.shipping_address || "";

        showAddLabPanel();
        return;
      }

      if (action === "delete") {
        const label = (r.lab_code || r.name || "this lab").toString();
        const ok = await confirmExact(`Delete ${label}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("labs")
          .delete()
          .eq("id", r.id)
          .select("id");

        if (error) { setLabMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setLabMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setLabMsg("Deleted ✅");
        await loadLabs();
      }
    });
  }

  return {
    resetLabsScreen,
    showViewLabsPanel
  };
}
