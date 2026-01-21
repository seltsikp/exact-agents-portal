// modules/userManagement.js
export function initUserManagement({ supabaseClient, ui, helpers, state }) {
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
    umPassword,
    umRole,
    umStatus,
    umPerms,
    umSaveBtn,
    umCancelBtn,

    umAssignClinicRow,     // keep IDs as-is (HTML already uses these)
    umAssignClinicSelect
  } = ui;

  const setMsg = (t) => { if (umMsg) umMsg.textContent = t || ""; };

  const getCurrentProfile = () => (state?.currentProfile ?? null);
  const isAdmin = () => ((getCurrentProfile()?.role || "").toLowerCase() === "admin");

  let usersById = {};
  let editingId = null;   // agent_users.id
  let addingNew = false;
  let searchDebounceTimer = null;
  const SEARCH_DEBOUNCE_MS = 300;

const MODULES = [
  { key: "customers", label: "Customer Management" },
  { key: "orders", label: "Orders" },                 // ✅ ADD THIS
  { key: "agents", label: "Agent Management" },
  { key: "accountManagers", label: "Account Managers" },
  { key: "productTypes", label: "Product Groups" },
  { key: "formulary", label: "EXACT Formulary" },
  { key: "labs", label: "Lab Management" },
  { key: "userMgmt", label: "User Management" }
];

  // =========================================================
  // Authoritative Agent map: agents.id -> agents.name
  // =========================================================
  async function ensureAgentNameMapLoaded() {
    if (state?.agentNameMap && Object.keys(state.agentNameMap).length > 0) return;

    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[UserMgmt] Failed loading agents for map:", error.message);
      state.agentNameMap = state.agentNameMap || {};
      return;
    }

    const map = {};
    (data || []).forEach(a => { map[a.id] = a.name || "Unnamed agent"; });
    state.agentNameMap = map;
  }

  function fillAgentSelect() {
    if (!umAssignClinicSelect) return;

    const map = state.agentNameMap || {};
    const entries = Object.entries(map); // [agent_id, agentName]

    umAssignClinicSelect.innerHTML =
      `<option value="">— Select agent —</option>` +
      entries
        .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")))
        .map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`)
        .join("");
  }

  function getRoleValueLower() {
    return String((umRole?.value || "agent")).trim().tomaxLowerCase?.() ?? String((umRole?.value || "agent")).trim().toLowerCase();
  }

  function refreshAgentAssignmentVisibility() {
    const admin = isAdmin();

    // Only admins can see/assign agent_id
    if (!admin) {
      show(umAssignClinicRow, false);
      if (umAssignClinicSelect) umAssignClinicSelect.value = "";
      return;
    }

    // Admin: show dropdown only when role == agent
    const roleLower = getRoleValueLower();
    const shouldShow = roleLower === "agent";

    show(umAssignClinicRow, shouldShow);
    if (shouldShow) fillAgentSelect();
    else if (umAssignClinicSelect) umAssignClinicSelect.value = "";
  }

  function getSelectedAgentIdOrNullForPayload(roleLower) {
    if (!isAdmin()) return null;
    if (roleLower !== "agent") return null;
    return (umAssignClinicSelect?.value || null);
  }

  // =========================================================
  // Permissions UI
  // =========================================================
function renderPerms(permsObj) {
  if (!umPerms) return;
  const p = permsObj && typeof permsObj === "object" ? permsObj : {};

  umPerms.innerHTML = MODULES.map(m => {
    const checked = !!p[m.key];

    // Optional: short helper text (remove if you don't want subtitles)
    const sub =
      m.key === "orders" ? "Create / view / manage orders" :
      m.key === "customers" ? "Add & manage customers" :
      m.key === "agents" ? "Manage clinics / agents" :
      m.key === "accountManagers" ? "Manage account managers" :
      m.key === "productTypes" ? "Manage product groups" :
      m.key === "formulary" ? "Ingredients + formulated products" :
      m.key === "labs" ? "Manage labs + addresses" :
      m.key === "userMgmt" ? "Admin-only user controls" :
      "";

    return `
      <label class="perm-card">
        <div>
          <div class="perm-label">${escapeHtml(m.label)}</div>
          ${sub ? `<div class="perm-sub">${escapeHtml(sub)}</div>` : ``}
        </div>

        <input
          type="checkbox"
          data-perm="${escapeHtml(m.key)}"
          ${checked ? "checked" : ""}
        />
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

  function applyRoleControls() {
    const admin = isAdmin();

    if (umRole) {
      umRole.disabled = !admin;
      if (!admin) umRole.value = "agent"; // USER
    }

    if (umStatus) {
      umStatus.disabled = !admin;
    }

    refreshAgentAssignmentVisibility();
  }

  function clearForm() {
    editingId = null;
    addingNew = false;

    if (umFullName) umFullName.value = "";
    if (umEmail) { umEmail.value = ""; umEmail.readOnly = false; }
    if (umPassword) { umPassword.value = ""; umPassword.disabled = false; }
    if (umRole) umRole.value = "agent";
    if (umStatus) umStatus.value = "active";
    renderPerms({});

    if (umAssignClinicSelect) umAssignClinicSelect.value = "";
    show(umAssignClinicRow, false);

    applyRoleControls();
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

  async function showViewUsersPanel() {
    show(umViewPanel, true);
    show(umEditPanel, false);
    show(umClearBtn, true);
    setMsg("Loading users…");
    await ensureAgentNameMapLoaded();
    await runSearch("");
    if (umSearch) umSearch.focus();
  }

  function showEditPanel() {
    show(umViewPanel, false);
    show(umEditPanel, true);
    show(umClearBtn, true);
  }

  async function openAddUser() {
    if (umSaveBtn) {
      umSaveBtn.disabled = false;
      umSaveBtn.textContent = "Save";
    }

    clearForm();
    addingNew = true;

    if (umPassword) umPassword.disabled = false;

    await ensureAgentNameMapLoaded();
    fillAgentSelect();
    applyRoleControls();

    showEditPanel();
    setMsg("Adding user — enter email + password, set role/status (admin only), assign agent (for USER), permissions, then Save.");
  }

  async function openEditUser(u) {
    if (umSaveBtn) {
      umSaveBtn.disabled = false;
      umSaveBtn.textContent = "Save";
    }

    editingId = u.id;
    addingNew = false;

    if (umPassword) {
      umPassword.value = "";
      umPassword.disabled = true;
    }

    if (umFullName) umFullName.value = u.full_name || "";

    if (umEmail) {
      umEmail.value = u.email || "";
      umEmail.readOnly = true;
      umEmail.title = "Email is locked to avoid mismatch with Supabase Auth. (Change-email flow can be added later.)";
    }

    if (umRole) umRole.value = u.role || "agent";
    if (umStatus) umStatus.value = u.status || "active";
    renderPerms(u.permissions || {});

    await ensureAgentNameMapLoaded();
    fillAgentSelect();

    applyRoleControls();

    // preselect existing agent_id for agents
    if (isAdmin() && String((u.role || "")).toLowerCase() === "agent") {
      show(umAssignClinicRow, true);
      if (umAssignClinicSelect) umAssignClinicSelect.value = u.agent_id || "";
    } else {
      show(umAssignClinicRow, false);
      if (umAssignClinicSelect) umAssignClinicSelect.value = "";
    }

    showEditPanel();
    setMsg("Editing user — update name/permissions (and role/status/agent if admin), then Save.");
  }

  function buildRowHTML(u) {
    const id = escapeHtml(u.id);
    const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
    const email = escapeHtml((u.email || "").trim() || "—");

    const roleRaw = ((u.role || "").trim() || "—").toLowerCase();
    const roleLabel = roleRaw === "admin" ? "ADMIN" : (roleRaw === "agent" ? "USER" : roleRaw.toUpperCase());

    const status = escapeHtml((u.status || "").trim() || "—");

    // Agent label (not clinic)
    const agentLabel = (u.agent_id && state.agentNameMap?.[u.agent_id])
      ? state.agentNameMap[u.agent_id]
      : (u.agent_id ? "Unknown agent" : "—");

    const agentLine = (roleRaw === "agent")
      ? `<div class="subtle">Agent: ${escapeHtml(agentLabel)}</div>`
      : `<div class="subtle">Agent: —</div>`;

    return `
      <div class="user-row" data-user-id="${id}">
        <div>
          <div style="font-weight:700;">${name}</div>
          <div class="subtle">${email}</div>
          ${agentLine}
        </div>

        <div>
          <div>Role: ${escapeHtml(roleLabel)}</div>
          <div class="subtle">Status: ${status}</div>
        </div>

        <div class="user-actions">
          <button data-action="edit" type="button">Edit</button>
          ${isAdmin() ? `<button data-action="delete" type="button" class="btn-danger">Delete</button>` : ``}
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
        await openEditUser(u);
        return;
      }

      if (action === "delete") {
        if (!isAdmin()) { setMsg("Permission denied."); return; }

        const label = (u.full_name || u.email || "this user").trim();
        const ok = await confirmExact(
          `Delete ${label}?\n\nThis will permanently delete this user and prevent them from logging in again.\n\nThis action cannot be undone.`
        );
        if (!ok) return;

        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData?.session) await supabaseClient.auth.refreshSession();

        const { data: freshSession } = await supabaseClient.auth.getSession();
        const accessToken = freshSession?.session?.access_token;

        if (!accessToken) { setMsg("Session expired. Please log in again."); return; }

        const anonKey = window.SUPABASE_ANON_KEY || "";
        const baseUrl = window.SUPABASE_URL || "";
        if (!anonKey) { setMsg("Missing SUPABASE_ANON_KEY."); return; }
        if (!baseUrl) { setMsg("Missing SUPABASE_URL."); return; }

        const fnUrl = `${baseUrl}/functions/v1/delete-user`;

        let res, text = "";
        try {
          res = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: anonKey
            },
            body: JSON.stringify({
              auth_user_id: u.auth_user_id,
              agent_user_id: u.id
            })
          });
          text = await res.text();
        } catch {
          setMsg("Delete failed: network error.");
          return;
        }

        if (!res.ok) {
          setMsg(`Delete failed (${res.status}): ${text || "(empty body)"}`);
          return;
        }

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

    await ensureAgentNameMapLoaded();

    let q = supabaseClient
      .from("agent_users")
      .select("id, auth_user_id, full_name, email, role, status, permissions, created_at, agent_id")
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

  // =========================================================
  // Buttons + role change handler
  // =========================================================
  if (umViewBtn) umViewBtn.addEventListener("click", () => showViewUsersPanel());
  if (umAddBtn) umAddBtn.addEventListener("click", () => openAddUser());
  if (umClearBtn) umClearBtn.addEventListener("click", () => resetUserScreen());

  if (umSearchBtn) umSearchBtn.addEventListener("click", async () => { await runSearch(umSearch?.value || ""); });
  if (umShowAllBtn) umShowAllBtn.addEventListener("click", async () => { await runSearch(""); });

  if (umSearch) umSearch.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await runSearch(umSearch.value || "");
  });

  if (umSearch) umSearch.addEventListener("input", () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => runSearch(umSearch.value || ""), SEARCH_DEBOUNCE_MS);
  });

  // Role changes show/hide agent dropdown (admin only)
  if (umRole) {
    umRole.addEventListener("change", async () => {
      await ensureAgentNameMapLoaded();
      fillAgentSelect();
      refreshAgentAssignmentVisibility();
    });
  }

  if (umCancelBtn) umCancelBtn.addEventListener("click", () => {
    clearForm();
    showViewUsersPanel();
  });

  // =========================================================
  // Save
  // =========================================================
  if (umSaveBtn) {
    umSaveBtn.addEventListener("click", async () => {
      const originalSaveLabel = umSaveBtn.textContent;

      if (umSaveBtn.disabled) return;
      umSaveBtn.disabled = true;
      setMsg("");

      const admin = isAdmin();

      const full_name = (umFullName?.value || "").trim() || null;
      const email = (umEmail?.value || "").trim().toLowerCase();
      const roleFromUI = (umRole?.value || "agent").trim();
      const statusFromUI = (umStatus?.value || "active").trim();
      const permissions = readPermsFromUI();
      const editingUser = (!addingNew && editingId) ? (usersById[editingId] || null) : null;

      if (!email) { setMsg("Email is required (this is the login ID)."); umSaveBtn.disabled = false; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg("Please enter a valid email address."); umSaveBtn.disabled = false; return; }

      const role = admin ? roleFromUI : "agent";
      const status = admin ? statusFromUI : "active";

      const roleLower = String(role || "").toLowerCase();
      const agent_id = getSelectedAgentIdOrNullForPayload(roleLower);

      // Enforce: agent users must have agent_id (admin assigns)
      if (admin && roleLower === "agent" && !agent_id) {
        setMsg("Please select an assigned agent.");
        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      if (admin && !addingNew && status === "inactive") {
        const ok = await confirmExact(
          "Set this user to INACTIVE?\n\nThey will be immediately signed out and will not be able to log in again unless reactivated."
        );
        if (!ok) {
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;
          return;
        }
      }

      // ADD
      if (addingNew) {
        umSaveBtn.textContent = "Saving…";

        const password = (umPassword?.value || "").trim();
        if (!password || password.length < 8) {
          setMsg("Password is required for new users (min 8 chars).");
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        await supabaseClient.auth.refreshSession();
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          setMsg("Session expired. Please log in again.");
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        const anonKey = window.SUPABASE_ANON_KEY || "";
        const baseUrl = window.SUPABASE_URL || "";
        if (!anonKey) { setMsg("Missing SUPABASE_ANON_KEY."); umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel; return; }
        if (!baseUrl) { setMsg("Missing SUPABASE_URL."); umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel; return; }

        const fnUrl = `${baseUrl}/functions/v1/create-user`;

        let res, text = "";
        try {
          res = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ email, password, full_name, role, status, permissions, agent_id })
          });
          text = await res.text();
        } catch {
          setMsg("Create user failed: network error.");
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        if (!res.ok) {
          if (res.status === 409) setMsg("Email already exists.");
          else if (res.status === 403) setMsg("Permission denied.");
          else setMsg(`Create user failed (${res.status}).`);
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        setMsg("User created ✅");
        clearForm();
        await showViewUsersPanel();

        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // EDIT
      if (!editingId) {
        setMsg("No user selected.");
        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      umSaveBtn.textContent = "Saving…";

      // Prevent self-downgrade
      const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
      const currentAuthUserId = currentSession?.user?.id || null;

      if (
        admin &&
        editingUser &&
        currentAuthUserId &&
        String(editingUser.auth_user_id) === String(currentAuthUserId) &&
        String((roleFromUI || "").toLowerCase()) !== "admin"
      ) {
        setMsg("You cannot remove your own ADMIN role.");
        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      const patch = admin
        ? { full_name, role, status, permissions, agent_id }
        : { full_name, permissions };

      const { data, error } = await supabaseClient
        .from("agent_users")
        .update(patch)
        .eq("id", editingId)
        .select("id");

      if (error) {
        setMsg("Update error: " + error.message);
        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      if (!data || data.length === 0) {
        setMsg("Update blocked (RLS) — no rows updated.");
        umSaveBtn.disabled = false;
        umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      setMsg("Saved ✅");
      clearForm();
      await showViewUsersPanel();

      umSaveBtn.disabled = false;
      umSaveBtn.textContent = originalSaveLabel;
    });
  }

  // Ensure controls correct before any click
  applyRoleControls();

  return {
    resetUserScreen,
    loadUsers: async () => { await showViewUsersPanel(); }
  };
}
