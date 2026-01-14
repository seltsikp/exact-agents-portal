// modules/labs.js
export function initLabManagement({ ui, helpers }) {
  const { show } = helpers;

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

  // temporary in-memory storage (we will replace with Supabase next step)
  let labs = [];
  let editingLabIndex = null;

  // simple html escape (so user input can’t break layout)
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

  function renderLabList() {
    if (!labList) return;

    if (labs.length === 0) {
      labList.innerHTML = `<p class="subtle" style="margin:0;">No labs yet. Click “Add lab”.</p>`;
      return;
    }

    labList.innerHTML = labs.map((l, idx) => `
      <div class="customer-row" data-lab-idx="${idx}">
        <div class="customer-main">
          <div class="name">${escapeHtml(l.name || "")}</div>
          <div class="meta">
            <span><b>Orders:</b> ${escapeHtml(l.ordersEmail || "")}</span>
            <span class="customer-dot">•</span>
            ${l.email
              ? `<span>Admin: ${escapeHtml(l.email)}</span>`
              : `<span style="opacity:.65;">No admin email</span>`}
            <span class="customer-dot">•</span>
            ${l.phone
              ? `<span>${escapeHtml(l.phone)}</span>`
              : `<span style="opacity:.65;">No phone</span>`}
          </div>
        </div>

        <div class="customer-context">
          <span class="pill-soft pill-soft-gold">Local (not saved to DB yet)</span>
        </div>

        <div class="customer-actions">
          <button class="btn btn-soft action-pill edit-pill" type="button" data-action="edit" data-idx="${idx}">Edit</button>
          <button class="btn action-pill delete-pill" type="button" data-action="delete" data-idx="${idx}">Delete</button>
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
    editingLabIndex = null;
  }

  function showViewLabsPanel() {
    show(lmViewPanel, true);
    show(lmAddPanel, false);
    show(lmClearBtn, true);
    setLabMsg("Viewing labs (local list for now).");
    renderLabList();
  }

  function showAddLabPanel() {
    show(lmViewPanel, false);
    show(lmAddPanel, true);
    show(lmClearBtn, true);

    if (editingLabIndex !== null) {
      setLabMsg("Editing lab — update fields and click Save lab.");
    } else {
      setLabMsg("Add a lab and click Save.");
    }

    if (lmName) lmName.focus();
  }

  // buttons
  if (lmViewBtn) lmViewBtn.addEventListener("click", showViewLabsPanel);
  if (lmAddBtn) lmAddBtn.addEventListener("click", () => {
    editingLabIndex = null;
    clearLabForm();
    showAddLabPanel();
  });
  if (lmClearBtn) lmClearBtn.addEventListener("click", resetLabsScreen);

  // save lab (local)
  if (lmSaveBtn) {
    lmSaveBtn.addEventListener("click", () => {
      const name = (lmName?.value || "").trim();
      if (!name) { setLabMsg("Lab name is required."); return; }

      const ordersEmail = (lmOrdersEmail?.value || "").trim();
      if (!ordersEmail) { setLabMsg("Orders / formulations email is required."); return; }

      const email = (lmEmail?.value || "").trim() || "";
      const phone = (lmPhone?.value || "").trim() || "";
      const address = (lmAddress?.value || "").trim() || "";
      const shipping = (lmShipping?.value || "").trim() || "";

      const record = { name, email, ordersEmail, phone, address, shipping };

      if (editingLabIndex !== null) {
        labs[editingLabIndex] = record;
        editingLabIndex = null;
        setLabMsg("Updated ✅ (local only — database next)");
      } else {
        labs.unshift(record);
        setLabMsg("Saved ✅ (local only — database next)");
      }

      clearLabForm();
      showViewLabsPanel();
    });
  }

  // edit/delete (local) — single click handler
  if (labList) {
    labList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const idx = Number(btn.getAttribute("data-idx"));
      if (Number.isNaN(idx)) return;

      const l = labs[idx];
      if (!l) return;

      if (action === "edit") {
        editingLabIndex = idx;

        if (lmName) lmName.value = l.name || "";
        if (lmEmail) lmEmail.value = l.email || "";
        if (lmOrdersEmail) lmOrdersEmail.value = l.ordersEmail || "";
        if (lmPhone) lmPhone.value = l.phone || "";
        if (lmAddress) lmAddress.value = l.address || "";
        if (lmShipping) lmShipping.value = l.shipping || "";

        showAddLabPanel();
        return;
      }

      if (action === "delete") {
        labs.splice(idx, 1);
        setLabMsg("Deleted ✅ (local only)");
        renderLabList();
        return;
      }
    });
  }

  return {
    resetLabsScreen
  };
}
