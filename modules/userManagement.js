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
    umPassword,
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
        <label class="perm-card" style="display:flex; gap:10px; align-items:center; padding:10px 12px; border:1px solid rgba(15,20,25,.10); border-radius:12px; background:#fff;">
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
    if (umPassword) umPassword.value = "";
    if (umRole) umRole.value = "agent";
    if (umStatus) umStatus.value = "active";
    renderPerms({});

    // default field states
    if (umEmail) umEmail.readOnly = false;
    if (umPassword) umPassword.disabled = false;
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

    // password required on add
    if (umPassword) {
      umPassword.disabled = false;
      umPassword.placeholder = "Temporary password (min 8 chars)";
    }

    showEditPanel();
    setMsg("Adding user — enter email + password, role/status, permissions, then Save.");
  }

  function openEditUser(u) {
    editingId = u.id;
    addingNew = false;

    if (umPassword) {
      umPassword.value = "";
      umPassword.disabled = true;
      umPassword.placeholder = "Password cannot be edited here (create new password flow later)";
    }

    if (umFullName) umFullName.value = u.full_name || "";
    if (umEmail) {
      umEmail.value = u.email || "";
      // IMPORTANT: editing agent_users email does NOT update Supabase Auth email
      // So we lock it to avoid mismatches.
      umEmail.readOnly = true;
      umEmail.title = "Email is locked to avoid mismatch with Supabase Auth. (If needed, build a dedicated change-email flow.)";
    }

    if (umRole) umRole.value = u.role || "agent";
    if (umStatus) umStatus.value = u.status || "active";
    renderPerms(u.permissions || {});

    showEditPanel();
    setMsg("Editing user — update name/role/status/permissions and click Save.");
  }

  function pill(text) {
    return `<span style="display:inline-block; padding:4px 10px; border-radius:999px; border:1px solid rgba(15,20,25,.10); font-size:12px; font-weight:700;">${escapeHtml(text)}</span>`;
  }

  function buildRowHTML(u) {
    const id = escapeHtml(u.id);
    const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
    const email = escapeHtml((u.email || "").trim() || "—");
    const role = (u.role || "").trim() || "—";
    const status = (u.status || "").trim() || "—";

    const perms = (u.permissions && typeof u.permissions === "object") ? u.permissions : {};
    const allowedKeys = Object.keys(perms).filter(k => !!perms[k]);
    const permsSummary = allowedKeys.length ? `${allowedKeys.length} modules` : "No modules";

    return `
      <div class="user-row" data-user-id="${id}" style="
        display:grid; grid-template-columns: 1.6fr 1fr 150px;
        gap:14px; align-items:center;
        padding:14px; border:1px solid rgba(15,20,25,.10); border-radius:14px; background:#fff;
        box-shadow:0 10px 22px rgba(15,20,25,.06);
      ">
        <div style="min-width:0;">
          <div style="font-weight:800;">${name}</div>
          <div class="subtle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${email}</div>
          <div class="subtle" style="margin-top:6px;">${escapeHtml(permsSummary)}</div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          ${pill(`Role: ${role}`)}
          ${pill(`Status: ${status}`)}
        </div>

        <div class="user-actions" style="display:flex; gap:10px; justify-content:flex-end; white-space:nowrap;">
          <button data-action="edit" type="button">Edit</button>
          <button data-action="deleteRow" type="button" class="btn-danger">Delete row</button>
          <button data-action="deleteAuth" type="button" class="btn-danger">Delete (Auth too)</button>
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

      // OPTION A (existing): delete ONLY agent_users row
      if (action === "deleteRow") {
        const label = (u.full_name || u.email || "this user").trim();
        const ok = await confirmExact(
          `Delete ${label}?\n\nThis deletes ONLY the agent_users row (not the Supabase Auth user).`
        );
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
        return;
      }

      // OPTION B: delete agent_users row + delete Auth user (Edge Function)
      if (action === "deleteAuth") {
        const label = (u.full_name || u.email || "this user").trim();
        const ok = await confirmExact(
          `Delete ${label}?\n\nThis will delete BOTH:\n• agent_users row\n• Supabase Auth user\n\nThis cannot be undone.`
        );
        if (!ok) return;

        await supabaseClient.auth.refreshSession();
        const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
        if (sessionErr) { setMsg("Session error: " + sessionErr.message); return; }
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) { setMsg("Not logged in. Please log in again."); return; }

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
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ auth_user_id: u.auth_user_id, agent_user_id: u.id, email: u.email })
          });
          text = await res.text();
        } catch (err) {
          setMsg("Delete failed: network error: " + String(err));
          return;
        }

        if (!res.ok) {
          setMsg(`Delete failed (${res.status}): ${text || "(empty body)"}`);
          return;
        }

        setMsg("Deleted (Auth + row) ✅");
        await runSearch(umSearch?.value || "");
        return;
      }
    });

    umList.dataset.bound = "1";
  }

  async function emailExistsInAgentUsers(email, excludeAgentUserId = null) {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return false;

    let q = supabaseClient
      .from("agent_users")
      .select("id")
      .eq("email", e)
      .limit(1);

    if (excludeAgentUserId) q = q.neq("id", excludeAgentUserId);

    const { data, error } = await q;
    if (error) {
      // If RLS blocks reads, we still have Edge Function enforcement via createUser
      console.warn("emailExistsInAgentUsers check failed:", error.message);
      return false;
    }
    return (data || []).length > 0;
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

  function friendlyCreateError(status, text) {
    const raw = String(text || "");
    const lower = raw.toLowerCase();

    // Edge function returns JSON often; but we keep it safe
    if (lower.includes("duplicate") && lower.includes("email")) return "That email already exists.";
    if (lower.includes("already") && lower.includes("registered")) return "That email is already registered in Auth.";
    if (lower.includes("email") && lower.includes("exists")) return "That email already exists.";
    if (status === 401 || lower.includes("invalid jwt") || lower.includes("missing authorization")) return "You are not authorised. Please log in again.";
    if (status === 403 || lower.includes("forbidden")) return "Forbidden: your user does not have admin rights.";
    return `Create user failed (${status}): ${raw || "(empty body)"}`;
  }

  if (umSaveBtn) {
    umSaveBtn.addEventListener("click", async () => {
      setMsg("");

      const full_name = (umFullName?.value || "").trim() || null;
      const email = (umEmail?.value || "").trim().toLowerCase();
      const role = (umRole?.value || "agent").trim();
      const status = (umStatus?.value || "active").trim();
      const permissions = readPermsFromUI();

      if (!email) { setMsg("Email is required (this is the login ID)."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg("Please enter a valid email address."); return; }
      if (!role) { setMsg("Role is required."); return; }
      if (!status) { setMsg("Status is required."); return; }

      // ADD
      if (addingNew) {
        const password = (umPassword?.value || "").trim();
        if (!password || password.length < 8) {
          setMsg("Password is required for new users (min 8 chars).");
          return;
        }

        // Duplicate email check against agent_users first (fast + clear)
        const exists = await emailExistsInAgentUsers(email);
        if (exists) {
          setMsg("That email already exists in Users (agent_users). Use a different email.");
          return;
        }

        // Ensure fresh session token
        await supabaseClient.auth.refreshSession();
        const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
        if (sessionErr) { setMsg("Session error: " + sessionErr.message); return; }

        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) { setMsg("Not logged in. Please log in again."); return; }

        const anonKey = window.SUPABASE_ANON_KEY || "";
        const baseUrl = window.SUPABASE_URL || "";
        if (!anonKey) { setMsg("Missing SUPABASE_ANON_KEY."); return; }
        if (!baseUrl) { setMsg("Missing SUPABASE_URL."); return; }

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
            body: JSON.stringify({ email, password, full_name, role, status, permissions })
          });
          text = await res.text();
        } catch (e) {
          setMsg("Create user failed: network error: " + String(e));
          return;
        }

        if (!res.ok) {
          setMsg(friendlyCreateError(res.status, text));
          return;
        }

        setMsg("User created ✅");
        clearForm();
        showViewUsersPanel();
        await runSearch("");
        return;
      }

      // EDIT (email locked; only update safe columns)
      if (!editingId) { setMsg("No user selected."); return; }

      const { data, error } = await supabaseClient
        .from("agent_users")
        .update({ full_name, role, status, permissions })
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
    resetUserScreen,
    loadUsers: async () => { showViewUsersPanel(); await runSearch(""); }
  };
}
