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
        <div class="customer-actions">
          <button class="btn-primary amgr-edit" type="button">Edit</button>
          <button class="btn-danger amgr-del" type="button">Delete</button>
        </div>
      </div>
    `).join("");

    bindRowActions();
  }

  function bindRowActions() {
    amgrList.querySelectorAll(".amgr-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".customer-row").dataset.id;
        editManager(id);
      });
    });

    amgrList.querySelectorAll(".amgr-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".customer-row").dataset.id;
        deleteManager(id);
      });
    });
  }

  function showView() {
    show(amgrViewPanel, true);
    show(amgrAddPanel, false);
    show(amgrClearBtn, true);
    loadManagers();
  }

  function showAdd() {
    editingId = null;
    clearForm();
    show(amgrViewPanel, false);
    show(amgrAddPanel, true);
    show(amgrClearBtn, true);
    setMsg("Add Account Manager.");
    amgrFirstName?.focus();
  }

  function editManager(id) {
    const m = managersById[id];
    if (!m) return;

    editingId = id;
    show(amgrViewPanel, false);
    show(amgrAddPanel, true);
    show(amgrClearBtn, true);
    setMsg("Editing Account Manager.");

    amgrFirstName.value = m.first_name;
    amgrLastName.value = m.last_name;
    amgrEmail.value = m.email;
    amgrPhone.value = m.phone || "";
  }

  async function deleteManager(id) {
    const m = managersById[id];
    const label = m ? `${m.am_code} — ${m.first_name} ${m.last_name}` : "this Account Manager";

    const ok = await confirmExact(`Delete ${label}?`);
    if (!ok) return;

    const { error } = await supabaseClient
      .from("account_managers")
      .delete()
      .eq("id", id);

    if (error) return setMsg("Delete failed: " + error.message);

    setMsg("Deleted ✅");
    loadManagers();
  }

  async function saveManager() {
    setMsg("");

    const payload = {
      first_name: amgrFirstName.value.trim(),
      last_name: amgrLastName.value.trim(),
      email: amgrEmail.value.trim(),
      phone: amgrPhone.value.trim() || null,
      address: amgrAddress.value.trim() || null,
      notes: amgrNotes.value.trim() || null
    };

    if (!payload.first_name || !payload.last_name || !payload.email) {
      return setMsg("First name, last name, and email are required.");
    }

    if (editingId) {
      const { error } = await supabaseClient
        .from("account_managers")
        .update(payload)
        .eq("id", editingId);

      if (error) return setMsg("Save failed: " + error.message);
    } else {
      const { error } = await supabaseClient
        .from("account_managers")
        .insert([payload]);

      if (error) return setMsg("Insert failed: " + error.message);
    }

    setMsg("Saved ✅");
    showView();
  }

  if (amgrViewBtn) amgrViewBtn.addEventListener("click", showView);
  if (amgrAddBtn) amgrAddBtn.addEventListener("click", showAdd);
  if (amgrClearBtn) amgrClearBtn.addEventListener("click", resetScreen);
  if (amgrSaveBtn) amgrSaveBtn.addEventListener("click", saveManager);

  return {
    resetAccountManagersScreen: resetScreen
  };
}
