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
    else metaLine = codePart || `<span style="opacity:.65;"
