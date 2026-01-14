// modules/customers.js
export function initCustomerManagement({
  supabaseClient,
  ui,
  helpers,
  state
}) {
  const {
    show,
    escapeHtml,
    formatDateShort,
    confirmExact,
    isValidEmail,
    isValidPhone,
    markField,
    clearFieldMarks
  } = helpers;

  const {
    viewCustomerMgmt,
    cmViewBtn,
    cmAddBtn,
    cmClearBtn,
    custMsg,
    cmViewPanel,
    cmAddPanel,
    cmSearch,
    cmSearchBtn,
    cmShowAllBtn,
    customerList,
    firstNameInput,
    lastNameInput,
    custEmailInput,
    custPhoneInput,
    addCustomerBtn,
    assignClinicRow,
    assignClinicSelect,
    agentClinicRow,
    agentClinicName
  } = ui;

  let customersById = {};
  let editingCustomerId = null;

  const setCustMsg = (t) => { if (custMsg) custMsg.textContent = t || ""; };

  // ----------------------------
  // UI helpers
  // ----------------------------
  function resetCustomerScreen() {
    show(cmViewPanel, false);
    show(cmAddPanel, false);
    show(cmClearBtn, false);

    if (customerList) customerList.innerHTML = "";
    customersById = {};
    editingCustomerId = null;

    clearAddForm();
    setCustMsg("");
  }

  function showViewCustomersPanel() {
    show(cmViewPanel, true);
    show(cmAddPanel, false);
    show(cmClearBtn, true);

    if (cmSearch) cmSearch.focus();
    setCustMsg("Enter a search term or click “Show all”.");
  }

  function showAddCustomerPanel() {
    show(cmViewPanel, false);
    show(cmAddPanel, true);
    show(cmClearBtn, true);

    setCustMsg("");

    if (state.currentProfile?.role === "admin") {
      show(assignClinicRow, true);
      show(agentClinicRow, false);
    } else {
      show(assignClinicRow, false);
      show(agentClinicRow, true);
    }

    validateCustomerFieldsLive();
    if (firstNameInput) firstNameInput.focus();
  }

  function clearAddForm() {
    if (firstNameInput) firstNameInput.value = "";
    if (lastNameInput) lastNameInput.value = "";
    if (custEmailInput) custEmailInput.value = "";
    if (custPhoneInput) custPhoneInput.value = "";
    editingCustomerId = null;
    clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);
  }

  function validateCustomerFieldsLive() {
    if (!cmAddPanel || cmAddPanel.style.display === "none") return;

    const first = (firstNameInput?.value || "").trim();
    const last  = (lastNameInput?.value || "").trim();
    const email = (custEmailInput?.value || "").trim();
    const phone = (custPhoneInput?.value || "").trim();

    if (!first) markField(firstNameInput, "error"); else markField(firstNameInput, "ok");
    if (!last) markField(lastNameInput, "error"); else markField(lastNameInput, "ok");

    if (!email) markField(custEmailInput, null);
    else if (!isValidEmail(email)) markField(custEmailInput, "error");
    else markField(custEmailInput, "ok");

    if (!phone) markField(custPhoneInput, null);
    else if (!isValidPhone(phone)) markField(custPhoneInput, "error");
    else markField(custPhoneInput, "ok");
  }

  // ----------------------------
  // Row renderer
  // ----------------------------
  function buildCustomerRowHTML(c) {
    const id = escapeHtml(c.id);
    const code = escapeHtml(c.customer_code || "");

    const first = (c.first_name ?? "").trim();
    const last = (c.last_name ?? "").trim();
    const fullName = `${first} ${last}`.trim() || "Unnamed Customer";

    const name = escapeHtml(fullName);
    const email = escapeHtml((c.email || "").trim());
    const phone = escapeHtml((c.phone || "").trim());
    const created = formatDateShort(c.created_at);

    let metaLine = "";
    const codePart = code ? `<span>${code}</span><span class="customer-dot">•</span>` : "";

    if (email && phone) metaLine = `${codePart}<span>${email}</span><span class="customer-dot">•</span><span>${phone}</span>`;
    else if (email) metaLine = `${codePart}<span>${email}</span>`;
    else if (phone) metaLine = `${codePart}<span>${phone}</span>`;
    else metaLine = codePart || `<span style="opacity:.65;">No contact details</span>`;

    const createdPill = created ? `<span class="pill-soft">Created: ${escapeHtml(created)}</span>` : "";

    return `
      <div class="customer-row" data-customer-id="${id}">
        <div class="customer-main">
          <div class="name">${name}</div>
          <div class="meta">${metaLine}</div>
        </div>
        <div class="customer-context">
          ${createdPill}
        </div>
        <div class="customer-actions">
          <button data-action="edit" type="button">Edit</button>
          <button data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

  // ----------------------------
  // List delegation
  // ----------------------------
  function ensureCustomerListDelegation() {
    if (!customerList) return;
    if (customerList.dataset.bound === "1") return;

    customerList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const row = e.target.closest(".customer-row");
      if (!row) return;

      const customerId = row.getAttribute("data-customer-id");
      const action = btn.getAttribute("data-action");
      const c = customersById[customerId];
      if (!c) return;

      if (action === "edit") {
        editingCustomerId = c.id;
        if (firstNameInput) firstNameInput.value = c.first_name || "";
        if (lastNameInput) lastNameInput.value = c.last_name || "";
        if (custEmailInput) custEmailInput.value = c.email || "";
        if (custPhoneInput) custPhoneInput.value = c.phone || "";
        showAddCustomerPanel();
        setCustMsg("Editing customer — click Save customer to update.");
        return;
      }

      if (action === "delete") {
        const name =
          `${c.first_name || ""} ${c.last_name || ""}`.trim() || "this customer";

        const ok = await confirmExact(`Delete ${name}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("customers")
          .delete()
          .eq("id", c.id)
          .select("id");

        if (error) { setCustMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setCustMsg("Delete blocked (RLS)."); return; }

        setCustMsg("Deleted ✅");
        await runCustomerSearch(cmSearch?.value || "");
      }
    });

    customerList.dataset.bound = "1";
  }

  // ----------------------------
  // Queries
  // ----------------------------
  async function runCustomerSearch(term) {
    if (!customerList) return;

    ensureCustomerListDelegation();

    customerList.innerHTML = "";
    customersById = {};
    setCustMsg("Searching…");

    let q = supabaseClient
      .from("customers")
      .select("id, customer_code, agent_id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.or([
        `first_name.ilike.%${esc}%`,
        `last_name.ilike.%${esc}%`,
        `email.ilike.%${esc}%`,
        `phone.ilike.%${esc}%`
      ].join(","));
    }

    const { data, error } = await q;
    if (error) { setCustMsg("Search error: " + error.message); return; }

    (data || []).forEach(c => { customersById[c.id] = c; });
    customerList.innerHTML = (data || []).map(buildCustomerRowHTML).join("");

    if (!data || data.length === 0) setCustMsg("No matches found.");
    else setCustMsg(`Found ${data.length} customer${data.length === 1 ? "" : "s"}.`);
  }

  // ----------------------------
  // Bind buttons
  // ----------------------------
  if (cmViewBtn) cmViewBtn.addEventListener("click", showViewCustomersPanel);
  if (cmAddBtn) cmAddBtn.addEventListener("click", () => { clearAddForm(); showAddCustomerPanel(); });
  if (cmClearBtn) cmClearBtn.addEventListener("click", resetCustomerScreen);
  if (cmSearchBtn) cmSearchBtn.addEventListener("click", () => runCustomerSearch(cmSearch?.value || ""));
  if (cmShowAllBtn) cmShowAllBtn.addEventListener("click", () => runCustomerSearch(""));
  if (cmSearch) cmSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runCustomerSearch(cmSearch.value || "");
  });

  if (addCustomerBtn) {
    addCustomerBtn.addEventListener("click", async () => {
      setCustMsg("");

      const first_name = (firstNameInput?.value || "").trim();
      const last_name  = (lastNameInput?.value || "").trim();
      const email = (custEmailInput?.value || "").trim() || null;
      const phone = (custPhoneInput?.value || "").trim() || null;

      clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);

      if (!first_name || !last_name) {
        setCustMsg("First and last name are required.");
        return;
      }

      let agent_id;
      if (state.currentProfile?.role === "admin") {
        agent_id = assignClinicSelect?.value;
        if (!agent_id) { setCustMsg("Please select a clinic."); return; }
      } else {
        agent_id = state.currentProfile?.agent_id;
      }

      if (editingCustomerId) {
        const { error } = await supabaseClient
          .from("customers")
          .update({ first_name, last_name, email, phone })
          .eq("id", editingCustomerId);

        if (error) { setCustMsg("Update error: " + error.message); return; }

        setCustMsg("Saved ✅");
        clearAddForm();
        showViewCustomersPanel();
        runCustomerSearch(cmSearch?.value || "");
        return;
      }

      const { error } = await supabaseClient
        .from("customers")
        .insert([{ agent_id, first_name, last_name, email, phone }]);

      if (error) { setCustMsg("Insert error: " + error.message); return; }

      setCustMsg("Customer added ✅");
      clearAddForm();
      showViewCustomersPanel();
    });
  }

  return {
    resetCustomerScreen,
    runCustomerSearch
  };
}
