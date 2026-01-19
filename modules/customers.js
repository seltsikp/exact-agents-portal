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
    custDobInput,
    custGenderInput,
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

  function clearAddForm() {
    if (firstNameInput) firstNameInput.value = "";
    if (lastNameInput) lastNameInput.value = "";
    if (custDobInput) custDobInput.value = "";
    if (custDobInput) custDobInput.value = "";

    if (custEmailInput) custEmailInput.value = "";
    if (custPhoneInput) custPhoneInput.value = "";
    editingCustomerId = null;
    clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);
  }

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

  function buildCustomerRowHTML(c, { role, agentNameMap }) {
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

    let clinicPill = "";
    if (role === "admin") {
      const clinicName = agentNameMap?.[c.agent_id] || "Unknown clinic";
      clinicPill = `<span class="pill-soft pill-soft-gold">Clinic: ${escapeHtml(clinicName)}</span>`;
    }

    const createdPill = created ? `<span class="pill-soft">Created: ${escapeHtml(created)}</span>` : "";

    const clinicName =
      role === "admin"
        ? (agentNameMap?.[c.agent_id] || "Unknown clinic")
        : (agentNameMap?.[state.currentProfile?.agent_id] || "Clinic");

    return `
      <div class="customer-row" data-customer-id="${escapeHtml(c.id)}">

        <!-- LEFT: NAME + CODE -->
        <div>
          <div style="font-weight:700;">${name}</div>
          <div class="subtle">${code || ""}</div>
        </div>

        <!-- MIDDLE: CLINIC + CREATED -->
        <div>
          <div>Clinic: ${escapeHtml(clinicName || "—")}</div>
          <div class="subtle">Created: ${escapeHtml(created || "—")}</div>
        </div>

        <!-- RIGHT: ACTIONS -->
        <div class="customer-actions">
          <button data-action="edit" type="button">Edit</button>
          <button data-action="delete" type="button">Delete</button>
        </div>

        <!-- EMAIL (FULL WIDTH, LAST ROW) -->
        ${(c.email || "").trim() ? (() => {
          const emailRaw = String(c.email || "").trim();
          const emailText = escapeHtml(emailRaw);
          const mailHref = "mailto:" + encodeURIComponent(emailRaw);
          return `
            <div class="customer-email">
              <a href="${mailHref}">${emailText}</a>
            </div>
          `;
        })() : ""}

      </div>
    `;
  }

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
        if (custDobInput) custDobInput.value = c.date_of_birth || "";
        if (custGenderInput) custGenderInput.value = c.gender || "";


        showAddCustomerPanel();
        setCustMsg("Editing customer — click Save customer to update.");
        return;
      }

      if (action === "delete") {
        setCustMsg("");

        const customerName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "this customer";
        const ok = await confirmExact(`Delete ${customerName}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("customers")
          .delete()
          .eq("id", c.id)
          .select("id");

        if (error) { setCustMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setCustMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setCustMsg("Deleted ✅");
        await runCustomerSearch(cmSearch?.value || "");
      }
    });

    customerList.dataset.bound = "1";
  }

  async function runCustomerSearch(term) {
    if (!customerList) return;

    ensureCustomerListDelegation();

    customerList.innerHTML = "";
    customersById = {};
    setCustMsg("Searching…");

    const role = state.currentProfile?.role || "agent";

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

    const rows = data || [];
    rows.forEach(c => { customersById[c.id] = c; });

    customerList.innerHTML = rows
      .map(c => buildCustomerRowHTML(c, { role, agentNameMap: state.agentNameMap }))
      .join("");

    if (rows.length === 0) setCustMsg("No matches found.");
    else setCustMsg(`Found ${rows.length} customer${rows.length === 1 ? "" : "s"}.`);
  }

  // live validation listeners
  [firstNameInput, lastNameInput, custEmailInput, custPhoneInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", validateCustomerFieldsLive);
    el.addEventListener("blur", validateCustomerFieldsLive);
  });

  // buttons
  if (cmViewBtn) cmViewBtn.addEventListener("click", () => showViewCustomersPanel());
  if (cmAddBtn) cmAddBtn.addEventListener("click", () => { clearAddForm(); showAddCustomerPanel(); });
  if (cmClearBtn) cmClearBtn.addEventListener("click", () => resetCustomerScreen());
  if (cmSearchBtn) cmSearchBtn.addEventListener("click", async () => { await runCustomerSearch(cmSearch?.value || ""); });
  if (cmShowAllBtn) cmShowAllBtn.addEventListener("click", async () => { await runCustomerSearch(""); });
  if (cmSearch) cmSearch.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await runCustomerSearch(cmSearch.value || "");
  });

  // save customer
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener("click", async () => {
      setCustMsg("");

      const first_name = (firstNameInput?.value || "").trim();
      const last_name  = (lastNameInput?.value || "").trim();
      const date_of_birth = String(custDobInput?.value || "").trim();
      const gender = String(custGenderInput?.value || "").trim();
      const email = (custEmailInput?.value || "").trim() || null;
      const phone = (custPhoneInput?.value || "").trim() || null;

      clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);

      if (!first_name) { markField(firstNameInput, "error"); setCustMsg("First name is required."); return; }
      markField(firstNameInput, "ok");

      if (!last_name) { markField(lastNameInput, "error"); setCustMsg("Last name is required."); return; }
      markField(lastNameInput, "ok");

     if (!date_of_birth) {  setCustMsg("Date of birth is required.");  return; }
      if (!gender) { setCustMsg("Gender is required."); return; }


      if (email && !isValidEmail(email)) { markField(custEmailInput, "error"); setCustMsg("Please enter a valid email address."); return; }
      if (email) markField(custEmailInput, "ok");

      if (phone && !isValidPhone(phone)) { markField(custPhoneInput, "error"); setCustMsg("Please enter a valid phone number."); return; }
      if (phone) markField(custPhoneInput, "ok");

      let agent_id = null;

      if (state.currentProfile?.role === "admin") {
        agent_id = assignClinicSelect?.value || null;
        if (!agent_id) { setCustMsg("Please select a clinic to assign this customer to."); return; }
      } else {
        agent_id = state.currentProfile?.agent_id || null;
        if (!agent_id) { setCustMsg("No clinic linked to this login."); return; }
      }

      if (editingCustomerId) {
        const { data, error } = await supabaseClient
          .from("customers")
         .update({ first_name, last_name, date_of_birth, gender, email, phone })
          .eq("id", editingCustomerId)
          .select("id");

        if (error) { setCustMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setCustMsg("Update blocked (RLS) — no rows updated."); return; }

        setCustMsg("Saved ✅");
        clearAddForm();
        showViewCustomersPanel();
        await runCustomerSearch(cmSearch?.value || "");
        return;
      }

      const { error } = await supabaseClient
        .from("customers")
        .insert([{ agent_id, first_name, last_name, date_of_birth, gender, email, phone }]);

        if (error) { 
        setCustMsg("Insert error: " + error.message); 
        return; 
      }

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

