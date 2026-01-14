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
      <div class="customer-row">
        <div class="customer-main">
          <div class="name">${escapeHtml(l.name)}</div>
         <div class="meta">
  <span><b>Orders:</b> ${escapeHtml(l.ordersEmail || "")}</span>
  <span class="customer-dot">•</span>
  ${l.email ? `<span>Admin: ${escapeHtml(l.email)}</span>` : `<span style="opacity:.65;">No admin email</span>`}
  <span class="customer-dot">•</span>
  ${l.phone ? `<span>${escapeHtml(l.phone)}</span>` : `<span style="opacity:.65;">No phone</span>`}
</div>

        </div>

        <div class="customer-context">
          <span class="pill-soft">Local (not saved to DB yet)</span>
        </div>

        <div class="customer-actions">
          <button class="btn" type="button" data-action="delete" data-idx="${idx}">Delete</button>
        </div>
      </div>
    `).join("");
  }

  // simple html escape (so user input can’t break layout)
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function resetLabsScreen() {
    show(lmViewPanel, false);
    show(lmAddPanel, false);
    show(lmClearBtn, false);
    setLabMsg("");
    clearLabForm();
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
    setLabMsg("Add a lab and click Save.");
    if (lmName) lmName.focus();
  }

  // buttons
  if (lmViewBtn) lmViewBtn.addEventListener("click", showViewLabsPanel);
  if (lmAddBtn) lmAddBtn.addEventListener("click", showAddLabPanel);
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

      labs.unshift({ name, email, ordersEmail, phone, address, shipping });
      setLabMsg("Saved ✅ (local only — database next)");
      clearLabForm();
      showViewLabsPanel();
    });
  }

  // delete lab (local)
  if (labList) {
    labList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='delete']");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-idx"));
      if (Number.isNaN(idx)) return;
      labs.splice(idx, 1);
      setLabMsg("Deleted ✅ (local only)");
      renderLabList();
    });
  }

  return {
    resetLabsScreen
  };
}
