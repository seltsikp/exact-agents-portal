// modules/userManagement.js
export function initUserManagement({ supabaseClient, ui, helpers, state }) {
  const { show, escapeHtml, confirmExact } = helpers;

  // Robust element getter: use ui mapping if present, otherwise DOM by id
  const el = (id) => (ui && ui[id]) ? ui[id] : document.getElementById(id);

  // Core UI
  const umViewBtn = el("umViewBtn");
  const umAddBtn = el("umAddBtn");
  const umClearBtn = el("umClearBtn");
  const umMsg = el("umMsg");
  const umViewPanel = el("umViewPanel");
  const umEditPanel = el("umEditPanel");

  const umSearch = el("umSearch");
  const umSearchBtn = el("umSearchBtn");
  const umShowAllBtn = el("umShowAllBtn");

  const umList = el("umList");

  const umFullName = el("umFullName");
  const umEmail = el("umEmail");
  const umPassword = el("umPassword");
  const umRole = el("umRole");
  const umStatus = el("umStatus");
  const umPerms = el("umPerms");
  const umSaveBtn = el("umSaveBtn");
  const umCancelBtn = el("umCancelBtn");

  // Clinic assignment UI (ADMIN assigns clinic for USER/agent)
  const umAssignClinicRow = el("umAssignClinicRow");
  const umAssignClinicSelect = el("umAssignClinicSelect");

  const setMsg = (t) => { if (umMsg) umMsg.textContent = t || ""; };

  const getCurrentProfile = () => (state?.currentProfile ?? null);
  const isAdmin = () => String((getCurrentProfile()?.role || "")).toLowerCase() === "admin";

  let usersById = {};
  let editingId = null;       // agent_users.id
  let addingNew = false;

  let searchDebounceTimer = null;
  const SEARCH_DEBOUNCE_MS = 300;

  // local cache for clinics (fallback if state.agentNameMap not ready)
  let clinicsCache = null; // [{id, name}]

  const MODULES = [
    { key: "customers", label: "Customer Management" },
    { key: "agents", label: "Agent Management" },
    { key: "accountManagers", label: "Account Managers" },
    { key: "productTypes", label: "Product Groups" },
    { key: "formulary", label: "EXACT Formulary" },
    { key: "labs", label: "Lab Management" },
    { key: "userMgmt", label: "User Management" }
  ];

  // =========================================================
  // Permissions UI
  // =========================================================
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

  // =========================================================
  // Clinic helpers (populate dropdown)
  // =========================================================
  function roleLower() {
    return String((umRole?.value || "agent")).trim().toLowerCase();
  }

  function shouldShowClinicAssign() {
    // Only ADMIN can assign clinic, and only when role is "agent" (USER)
    return isAdmin() && roleLower() === "agent";
  }

  async function loadClinicsFallback() {
    // Try state.agentNameMap first (fast)
    const map = state?.agentNameMap || null;
    const entries = map && typeof map === "object" ? Object.entries(map) : [];

    if (entries.length > 0) {
      clinicsCache = entries
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return clinicsCache;
    }

    // Fallback: query agents table directly
    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[userMgmt] load clinics fallback error:", error.message);
      clinicsCache = [];
      return clinicsCache;
    }

    clinicsCache = (data || []).map(r => ({ id: r.id, name: r.name }));
    return clinicsCache;
  }

  async function fillClinicSelect() {
    if (!umAssignClinicSelect) return;

    const clinics = clinicsCache || await loadClinicsFallback();

    umAssignClinicSelect.innerHTML =
      `<option value="">— Select clinic —</option>` +
      clinics
        .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "Unnamed")}</option>`)
        .join("");
  }

  async function syncClinicAssignUI() {
    if (!umAssignClinicRow) return;

    const showRow = shouldShowClinicAssign();
    show(umAssignClinicRow, showRow);

    if (!showRow) {
      if (umAssignClinicSelect) umAssignClinicSelect.value = "";
      return;
    }

    await fillClinicSelect();
  }

  function selectedClinicForPayloadOrNull() {
    if (!shouldShowClinicAssign()) return null;
    return (umAssignClinicSelect?.value || null);
  }

  // =========================================================
  // Role/status controls
  // =========================================================
  function applyRoleControls() {
    const admin = isAdmin();

    if (umRole) {
      umRole.disabled = !admin;
      if (!admin) umRole.value = "agent"; // USER
    }
    if (umStatus) {
      umStatus.disabled = !admin;
    }
  }

  // =========================================================
  // Screen helpers
  // =========================================================
  function clearForm() {
    editingId = null;
    addingNew = false;

    if (umFullName) umFullName.value = "";
    if (umEmail) { umEmail.value = ""; umEmail.readOnly = false; umEmail.title = ""; }
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

  async function openAddUser() {
    if (umSaveBtn) { umSaveBtn.disabled = false; umSaveBtn.textContent = "Save user"; }

    clearForm();
    addingNew = true;

    if (umPassword) umPassword.disabled = false;

    applyRoleControls();
    showEditPanel();

    await syncClinicAssignUI(); // <-- ensure dropdown populated when shown

    setMsg("Adding user — enter email + password, set role/status (admin only), select clinic (for USER), permissions, then Save.");
  }

  async function openEditUser(u) {
    if (umSaveBtn) { umSaveBtn.disabled = false; umSaveBtn.textContent = "Save user"; }

    editingId = u.id;
    addingNew = false;

    if (umPassword) { umPassword.value = ""; umPassword.disabled = true; }

    if (umFullName) umFullName.value = u.full_name || "";

    if (umEmail) {
      umEmail.value = u.email || "";
      umEmail.readOnly = true;
      umEmail.title = "Email is locked to avoid mismatch with Supabase Auth.";
    }

    if (umRole) umRole.value = u.role || "agent";
    if (umStatus) umStatus.value = u.status || "active";
    renderPerms(u.permissions || {});

    applyRoleControls();
    showEditPanel();

    await syncClinicAssignUI();
    if (shouldShowClinicAssign() && umAssignClinicSelect) {
      umAssignClinicSelect.value = u.agent_id || "";
    }

    setMsg("Editing user — update name/permissions (and role/status/clinic if admin), then Save.");
  }

  function buildRowHTML(u) {
    const id = escapeHtml(u.id);
    const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
    const email = escapeHtml((u.email || "").trim() || "—");

    const r = String(u.role || "").trim().toLowerCase();
    const roleLabel = r === "admin" ? "ADMIN" : (r === "agent" ? "USER" : r.toUpperCase());
    const status = escapeHtml((u.status || "").trim());

    return `
      <div class="user-row" data-user-id="${id}">
        <div>
          <div style="font-weight:700;">${name}</div>
          <div class="subtle">${email}</div>
        </div>

        <div>
          <div>Role: ${escapeHtml(roleLabel)}</div>
          <div class="subtle">Status: ${status || "—"}</div>
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

        await supabaseClient.auth.refreshSession();
        const { data: sess } = await supabaseClient.auth.getSession();
        const accessToken = sess?.session?.access_token;

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
            body: JSON.stringify({ auth_user_id: u.auth_user_id, agent_user_id: u.id })
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
    setMsg(rows.length === 0 ? "No matches found." : `Found ${rows.length} user${rows.length === 1 ? "" : "s"}.`);
  }

  // =========================================================
  // Buttons + handlers
  // =========================================================
  if (umViewBtn) umViewBtn.addEventListener("click", () => showViewUsersPanel());
  if (umAddBtn) umAddBtn.addEventListener("click", async () => { await openAddUser(); });
  if (umClearBtn) umClearBtn.addEventListener("click", () => resetUserScreen());

  if (umSearchBtn) umSearchBtn.addEventListener("click", async () => { await runSearch(umSearch?.value || ""); });
  if (umShowAllBtn) umShowAllBtn.addEventListener("click", async () => { await runSearch(""); });

  if (umSearch) umSearch.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await runSearch(umSearch.value || "");
  });

  if (umSearch) umSearch.addEventListener("input", () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      runSearch(umSearch.value || "");
    }, SEARCH_DEBOUNCE_MS);
  });

  if (umCancelBtn) umCancelBtn.addEventListener("click", () => {
    clearForm();
    showViewUsersPanel();
  });

  // Role changes should toggle clinic dropdown (ADMIN only)
  if (umRole) {
    umRole.addEventListener("change", async () => {
      await syncClinicAssignUI();
    });
  }

  if (umSaveBtn) {
    umSaveBtn.addEventListener("click", async () => {
      const originalSaveLabel = umSaveBtn.textContent || "Save user";
      if (umSaveBtn.disabled) return;

      umSaveBtn.disabled = true;
      umSaveBtn.textContent = "Saving…";
      setMsg("");

      const admin = isAdmin();

      const full_name = (umFullName?.value || "").trim() || null;
      const email = (umEmail?.value || "").trim().toLowerCase();
      const roleFromUI = (umRole?.value || "agent").trim();
      const statusFromUI = (umStatus?.value || "active").trim();
      const permissions = readPermsFromUI();
      const editingUser = (!addingNew && editingId) ? (usersById[editingId] || null) : null;

      if (!email) {
        setMsg("Email is required (this is the login ID).");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMsg("Please enter a valid email address.");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // Enforce role rules (UI + hard client-side)
      const role = admin ? roleFromUI : "agent";
      const status = admin ? statusFromUI : "active";

      const agent_id = selectedClinicForPayloadOrNull();

      // If admin creating/editing USER/agent, clinic is required
      if (admin && String(role).toLowerCase() === "agent" && !agent_id) {
        setMsg("Please select an assigned agent.");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // Confirm inactivation
      if (admin && !addingNew && String(status).toLowerCase() === "inactive") {
        const ok = await confirmExact(
          "Set this user to INACTIVE?\n\nThey will not be able to log in again unless reactivated."
        );
        if (!ok) {
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
          return;
        }
      }

      // =========================================================
      // ADD
      // =========================================================
      if (addingNew) {
        const password = (umPassword?.value || "").trim();
        if (!password || password.length < 8) {
          setMsg("Password is required for new users (min 8 chars).");
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        await supabaseClient.auth.refreshSession();
        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          setMsg("Session expired. Please log in again.");
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
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
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ email, password, full_name, role, status, permissions, agent_id })
          });
          text = await res.text();
        } catch {
          setMsg("Create user failed: network error.");
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        if (!res.ok) {
          if (res.status === 409) setMsg("Email already exists.");
          else if (res.status === 403) setMsg("Permission denied.");
          else setMsg(`Create user failed (${res.status}). ${text || ""}`.trim());
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
          return;
        }

        setMsg("User created ✅");
        clearForm();
        showViewUsersPanel();
        await runSearch("");

        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // =========================================================
      // EDIT
      // =========================================================
      if (!editingId) {
        setMsg("No user selected.");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // Prevent self-downgrade
      const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
      const currentAuthUserId = currentSession?.user?.id || null;

      if (
        admin &&
        editingUser &&
        currentAuthUserId &&
        String(editingUser.auth_user_id) === String(currentAuthUserId) &&
        String(roleFromUI).toLowerCase() !== "admin"
      ) {
        setMsg("You cannot remove your own ADMIN role.");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      // Prevent downgrading last active admin
      if (
        admin &&
        editingUser &&
        String(editingUser.role || "").toLowerCase() === "admin" &&
        String(editingUser.status || "").toLowerCase() === "active" &&
        String(roleFromUI).toLowerCase() !== "admin"
      ) {
        const { count, error: adminCountErr } = await supabaseClient
          .from("agent_users")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("status", "active")
          .neq("auth_user_id", editingUser.auth_user_id);

        if (adminCountErr || !count || count < 1) {
          setMsg("Cannot downgrade the last active admin.");
          umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
          return;
        }
      }

      // Update patch (email locked)
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
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }
      if (!data || data.length === 0) {
        setMsg("Update blocked (RLS) — no rows updated.");
        umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
        return;
      }

      setMsg("Saved ✅");
      clearForm();
      showViewUsersPanel();
      await runSearch(umSearch?.value || "");

      umSaveBtn.disabled = false; umSaveBtn.textContent = originalSaveLabel;
    });
  }

  // Initial controls (don’t call syncClinicAssignUI here; it’s async and we only need it when editor opens)
  applyRoleControls();

  return {
    resetUserScreen,
    loadUsers: async () => { showViewUsersPanel(); await runSearch(""); }
  };
}
