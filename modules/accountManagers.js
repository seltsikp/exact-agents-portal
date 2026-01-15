// modules/accountManagers.js
export function initAccountManagersManagement({ supabaseClient, ui, helpers }) {
  const { show, confirmExact } = helpers;

  const {
    amgrViewBtn,
    amgrAddBtn,
    amgrClearBtn,
    amgrMsg,
    amgrViewPanel,
    amgrAddPanel,
    amgrList,

    amgrFirstName,
    amgrLastName,
    amgrEmail,
    amgrPhone,
    amgrAddress,
    amgrNotes,
    amgrSaveBtn
  } = ui;

  const setMsg = (t) => { if (amgrMsg) amgrMsg.textContent = t || ""; };

  let managersById = {};
  let editingId = null;

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function clearForm() {
    if (amgrFirstName) amgrFirstName.value = "";
    if (amgrLastName) amgrLastName.value = "";
    if (amgrEmail) amgrEmail.value = "";
    if (amgrPhone) amgrPhone.value = "";
    if (amgrAddress) amgrAddress.value = "";
    if (amgrNotes) amgrNotes.value = "";
  }

  function resetScreen() {
    show(amgrViewPanel, false);
    show(amgrAddPanel, false);
    show(amgrClearBtn, false);
    setMsg("");
    clearForm();
    editingId = null;
    if (amgrList) amgrList.innerHTML = "";
  }

  async function loadManagers() {
    setMsg("Loading…");
    managersById = {};
    if (amgrList) amgrList.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("account_managers")
      .select("id, am_code, first_name, last_name, email, phone, status")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Load failed: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      setMsg("No Account Managers yet.");
      return;
    }

    data.forEach(m => { managersById[m.id] = m; });
    setMsg(`Found ${data.length}.`);

    amgrList.innerHTML = data.map(m => `
      <div class="customer-row" data-id="${m.id}">
        <div><strong>${esc(m.am_code)}</strong></div>
        <div>
          ${esc(m.first_name)} ${esc(m.last_name)}
          <div class="subtle">${esc(m.email)}</div>
        </div>
        <div>${esc(m.phone || "")}</div>
        <div cla
