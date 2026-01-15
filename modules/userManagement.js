// modules/userManagement.js
export function initUserManagement({ supabaseClient, ui, helpers }) {
  const { show, escapeHtml, confirmExact } = helpers;

  const {
    umViewBtn, umClearBtn, umMsg,
    umViewPanel, umEditPanel, umList,
    umFullName, umEmail, umRole, umStatus,
    umPerms, umSaveBtn, umCancelBtn
  } = ui;

  const setMsg = (t) => { if (umMsg) umMsg.textContent = t || ""; };

  // Keys must match view keys used by navigation + app canAccess()
  const MODULES = [
    { key: "customers", label: "Customer Management" },
    { key: "agents", label: "Agent Management" },
    { key: "accountManagers", label: "Account Managers" },
    { key: "productTypes", label: "Product Types" },
    { key: "formulary", label: "EXACT Formulary" },
    { key: "labs", label: "Lab Management" },
    { key: "userMgmt", label: "User Management" }
  ];

  let usersById = {};
  let editingUserId = null;

  function clearEditForm() {
    editingUserId = null;
    if (umFullName) umFullName.value = "";
    if (umEmail) umEmail.value = "";
    if (umRole) umRole.value = "agent";
    if (umStatus) umStatus.value = "active";
    renderPerms({});
  }

  function renderPerms(permsObj) {
    if (!umPerms) return;
    const p = permsObj && typeof permsObj === "object" ? permsObj : {};
    umPerms.innerHTML = MODULES.map(m => {
      const checked = !!p[m.key];
      return `
        <label style="display:flex; align-items:center; gap:10px; border:1px solid rgba(15,20,25,.10); padding:10px 12px; border-radius:12px; background:#fff;">
          <input type="checkbox" data-perm="${escapeHtml(m.key)}" ${checked ? "checked" : ""} />
          <span style="font-weight:600;">${escapeHtml(m.label)}</span>
        </label>
      `;
    }).join("");
  }

  function readPermsFromUI() {
    const out = {};
    if (!umPerms) return out;
    umPerms.querySelectorAll("input[type=checkbox][data-perm]").forEach(cb => {
      const k = cb.getAttribute("data-perm");
      out[k] = !!cb.checked;
    });
    return out;
  }

  function resetUserScreen() {
    show(umViewPanel, false);
    show(umEditPanel, false);
    show(umClearBtn, false);
    if (umList) umList.innerHTML = "";
    usersById = {};
    clearEditForm();
    setMsg("");
  }

  async function loadUsers() {
    if (!umList) return;

    setMsg("Loading users…");
    usersById = {};
    umList.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("agent_users")
      .select("id, auth_user_id, full_name, email, role, status, permissions, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Load error: " + error.message);
      return;
    }

    const rows = data || [];
    rows.forEach(u => { usersById[u.id] = u; });

    if (rows.length === 0) {
      setMsg("No users found.");
      return;
    }

    setMsg(`Found ${rows.length} user${rows.length === 1 ? "" : "s"}.`);

    umList.innerHTML = rows.map(u => {
      const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
      const email = escapeHtml((u.email || "").trim());
      const role = escapeHtml(u.role || "");
      const status = escapeHtml(u.status || "");
      const id = escapeHtml(u.id);

      return `
        <div class="customer-row" data-user-id="${id}">
          <div>
            <div style="font-weight:700;">${name}</div>
            <div class="subtle">${email || ""}</div>
          </div>

          <div>
            <div>Role: <strong>${role}</strong></div>
            <div class="subtle">Status: ${status}</div>
          </div>

          <div class="customer-actions">
            <button data-action="edit" type="button">Edit</button>
            <button data-action="disable" type="button">${status === "active" ? "Disable" : "Enable"}</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function showViewPanel() {
    show(umViewPanel, true);
    show(umEditPanel, false);
    show(umClearBtn, true);
    loadUsers();
  }

  function showEditPanel() {
    show(umViewPanel, false);
    show(umEditPanel, true);
    show(umClearBtn, true);
  }

  // Buttons
  if (umViewBtn) umViewBtn.addEventListener("click", showViewPanel);
  if (umClearBtn) umClearBtn.addEventListener("click", resetUserScreen);

  if (umCancelBtn) {
    umCancelBtn.addEventListener("click", () => {
      clearEditForm();
      showViewPanel();
    });
  }

  // List click delegation
  if (umList) {
    umList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const row = e.target.closest(".customer-row");
      if (!row) return;

      const userId = row.getAttribute("data-user-id");
      const u = usersById[userId];
      if (!u) return;

      const action = btn.getAttribute("data-action");

      if (action === "edit") {
        editingUserId = u.id;
        if (umFullName) umFullName.value = u.full_name || "";
        if (umEmail) umEmail.value = u.email || "";
        if (umRole) umRole.value = u.role || "agent";
        if (umStatus) umStatus.value = u.status || "active";
        renderPerms(u.permissions || {});
        setMsg("Editing user — update fields and click Save user.");
        showEditPanel();
        return;
      }

      if (action === "disable") {
        const next = (u.status === "active") ? "inactive" : "active";
        const ok = await confirmExact(`Set this user to ${next}?`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("agent_users")
          .update({ status: next })
          .eq("id", u.id)
          .select("id");

        if (error) { setMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setMsg("Update blocked (RLS) — no rows updated."); return; }

        setMsg("Updated ✅");
        await loadUsers();
      }
    });
  }

  // Save user
  if (umSaveBtn) {
    umSaveBtn.addEventListener("click", async () => {
      if (!editingUserId) { setMsg("No user selected."); return; }

      const full_name = (umFullName?.value || "").trim() || null;
      const email = (umEmail?.value || "").trim() || null;
      const role = (umRole?.value || "agent").trim();
      const status = (umStatus?.value || "active").trim();
      const permissions = readPermsFromUI();

      const { data, error } = await supabaseClient
        .from("agent_users")
        .update({ full_name, email, role, status, permissions })
        .eq("id", editingUserId)
        .select("id");

      if (error) { setMsg("Save error: " + error.message); return; }
      if (!data || data.length === 0) { setMsg("Save blocked (RLS) — no rows updated."); return; }

      setMsg("Saved ✅");
      clearEditForm();
      showViewPanel();
    });
  }

  return {
    resetUserScreen,
    showViewPanel
  };
}
