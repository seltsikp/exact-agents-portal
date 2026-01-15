// modules/userManagement.js
export function initUserManagement({ supabaseClient, ui, helpers }) {
  const { show, escapeHtml, confirmExact } = helpers;

  const {
    umViewBtn,
    umAddBtn,
    umClearBtn,
    umMsg,

    umViewPanel,
    umEditPanel,

    umSearch,
    umSearchBtn,
    umShowAllBtn,

    umList,

    umFullName,
    umEmail,
    umRole,
    umStatus,
    umPerms,
    umSaveBtn,
    umCancelBtn
  } = ui;

  const setMsg = (t) => { if (umMsg) umMsg.textContent = t || ""; };

  let usersById = {};
  let editingId = null;   // agent_users.id
  let addingNew = false;

  const MODULES = [
    { key: "customers", label: "Customer Management" },
    { key: "agents", label: "Agent Management" },
    { key: "accountManagers", label: "Account Managers" },
    { key: "productTypes", label: "Product Types" },
    { key: "formulary", label: "EXACT Formulary" },
    { key: "labs", label: "Lab Management" },
    { key: "userMgmt", label: "User Management" }
  ];

  function renderPerms(permsObj) {
    if (!umPerms) return;
    const p = permsObj && typeof permsObj === "object" ? permsObj : {};
    umPerms.innerHTML = MODULES.map(m => {
      const checked = !!p[m.key];
      return `
        <label class="perm-card">
          <input type="checkbox" data-perm="${escapeHtml(m.key)}" ${checked ? "checked" : ""} />
          <span>${escapeHtml(m.label)}</span>
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

  function clearForm() {
    editingId = null;
    addingNew = false;

    if (umFullName) umFullName.value = "";
    if (umEmail) umEmail.value = "";
    if (umRole) umRole.value = "agent";
    if (umStatus) umStatus.value = "active";
    renderPerms({});
  }

  function resetUserScreen() {
    show(umViewPanel, false);
    show(umEditPanel, false);
    show(umClearBtn, false);

    if (umList) umList.innerHTML = "";
    if (umSearch) umSearch.value = "";

    usersById = {};
    editingId = null;
    addingNew = false;

    clearForm();
    setMsg("");
  }

  function showViewUsersPanel() {
    show(umViewPanel, true);
    show(umEditPanel, false);
    show(umClearBtn, true);
    setMsg("Loading users…");
    runSearch("");
    if (umSearch) umSearch.focus();
  }

  function showEditPanel() {
    show(umViewPanel, false);
    show(umEditPanel, true);
    show(umClearBtn, true);
  }

  function openAddUser() {
    clearForm();
    addingNew = true;
    
    showEditPanel();
    setMsg("Adding user — paste Auth User ID, choose role/status, set permissions, then Save.");

  }

  function openEditUser(u) {
    editingId = u.id;
    addingNew = false;

   
    if (umFullName) umFullName.value = u.full_name || "";
    if (umEmail) umEmail.value = u.email || "";
    if (umRole) umRole.value = u.role || "agent";
    if (umStatus) umStatus.value = u.status || "active";
    renderPerms(u.permissions || {});

    showEditPanel();
    setMsg("Editing user — update fields and click Save user.");
  }

  function buildRowHTML(u) {
    const id = escapeHtml(u.id);
    const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
    const email = escapeHtml((u.email || "").trim() || "—");
    const role = escapeHtml((u.role || "").trim());
    const status = escapeHtml((u.status || "").trim());

    return `
      <div class="user-row" data-user-id="${id}">
        <div>
          <div style="font-weight:700;">${name}</div>
          <div class="subtle">${email}</div>
        </div>

        <div>
          <div>Role: ${role || "—"}</div>
          <div class="subtle">Status: ${status || "—"}</div>
        </div>

        <div class="user-actions">
          <button data-action="edit" type="button">Edit</button>
          <button data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

  function ensureListDelegation() {
    if (!umList) return;
    if (umList.dataset.bound === "1") return;

    umList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const row = e.target.closest(".user-row");
      if (!row) return;

      const id = row.getAttribute("data-user-id");
      const action = btn.getAttribute("data-action");
      const u = usersById[id];
      if (!u) return;

      if (action === "edit") {
        openEditUser(u);
        return;
      }

      if (action === "delete") {
        const label = (u.full_name || u.email || "this user").trim();
        const ok = await confirmExact(`Delete ${label}?\n\nThis deletes ONLY the agent_users row (not the Supabase Auth user).`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("agent_users")
          .delete()
          .eq("id", u.id)
          .select("id");

        if (error) { setMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setMsg("Deleted ✅");
        await runSearch(umSearch?.value || "");
      }
    });

    umList.dataset.bound = "1";
  }

  async function runSearch(term) {
    if (!umList) return;

    ensureListDelegation();

    umList.innerHTML = "";
    usersById = {};
    setMsg("Searching…");

    let q = supabaseClient
      .from("agent_users")
      .select("id, auth_user_id, full_name, email, role, status, permissions, created_at")
      .order("created_at", { ascending: false });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.or([
        `full_name.ilike.%${esc}%`,
        `email.ilike.%${esc}%`,
        `role.ilike.%${esc}%`,
        `status.ilike.%${esc}%`
      ].join(","));
    }

    const { data, error } = await q;
    if (error) { setMsg("Search error: " + error.message); return; }

    const rows = data || [];
    rows.forEach(u => { usersById[u.id] = u; });

    umList.innerHTML = rows.map(buildRowHTML).join("");
    if (rows.length === 0) setMsg("No matches found.");
    else setMsg(`Found ${rows.length} user${rows.length === 1 ? "" : "s"}.`);
  }

  // --- buttons ---
  if (umViewBtn) umViewBtn.addEventListener("click", () => showViewUsersPanel());
  if (umAddBtn) umAddBtn.addEventListener("click", () => openAddUser());
  if (umClearBtn) umClearBtn.addEventListener("click", () => resetUserScreen());

  if (umSearchBtn) umSearchBtn.addEventListener("click", async () => { await runSearch(umSearch?.value || ""); });
  if (umShowAllBtn) umShowAllBtn.addEventListener("click", async () => { await runSearch(""); });
  if (umSearch) umSearch.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await runSearch(umSearch.value || "");
  });

  if (umCancelBtn) umCancelBtn.addEventListener("click", () => {
    clearForm();
    showViewUsersPanel();
  });

  if (umSaveBtn) {
    umSaveBtn.addEventListener("click", async () => {
      setMsg("");

     const full_name = (umFullName?.value || "").trim() || null;
const email = (umEmail?.value || "").trim() || null;
const role = (umRole?.value || "agent").trim();
const status = (umStatus?.value || "active").trim();
const permissions = readPermsFromUI();

if (!email) {
  setMsg("Email is required (this is the login ID).");
  return;
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  setMsg("Please enter a valid email address.");
  return;
}

if (!role) { setMsg("Role is required."); return; }
if (!status) { setMsg("Status is required."); return; }

      // ADD
      if (addingNew) {
               const { error } = await supabaseClient
          .from("agent_users")
          .insert([{
            auth_user_id,
            full_name,
            email,
            role,
            status,
            permissions
          }]);

        if (error) { setMsg("Insert error: " + error.message); return; }

        setMsg("User added ✅");
        clearForm();
        showViewUsersPanel();
        await runSearch("");
        return;
      }

      // EDIT
      if (!editingId) { setMsg("No user selected."); return; }

      const { data, error } = await supabaseClient
        .from("agent_users")
        .update({ full_name, email, role, status, permissions })
        .eq("id", editingId)
        .select("id");

      if (error) { setMsg("Update error: " + error.message); return; }
      if (!data || data.length === 0) { setMsg("Update blocked (RLS) — no rows updated."); return; }

      setMsg("Saved ✅");
      clearForm();
      showViewUsersPanel();
      await runSearch(umSearch?.value || "");
    });
  }

  return {
    resetUserScreen: resetUserScreen,
    loadUsers: async () => { showViewUsersPanel(); await runSearch(""); }
  };
}
