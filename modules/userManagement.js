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
    umCancelBtn
  } = ui;

  const setMsg = (t) => { if (umMsg) umMsg.textContent = t || ""; };

  const getCurrentProfile = () => (state?.currentProfile ?? null);
  const isAdmin = () => ((getCurrentProfile()?.role || "").toLowerCase() === "admin");

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

  function applyRoleControls() {
    // Only ADMIN can choose role + status (your requirement)
    const admin = isAdmin();

    if (umRole) {
      umRole.disabled = !admin;
      if (!admin) umRole.value = "agent"; // USER
    }

    if (umStatus) {
      umStatus.disabled = !admin;
      // non-admin can’t toggle status
    }
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

  function openAddUser() {
    clearForm();
    addingNew = true;

    // New users need a password
    if (umPassword) umPassword.disabled = false;

    // Non-admin cannot choose role; default USER (agent)
    applyRoleControls();

    showEditPanel();
    setMsg("Adding user — enter email + password, set status (admin only), permissions, then Save.");
  }

  function openEditUser(u) {
    editingId = u.id;
    addingNew = false;

    // Password never editable here
    if (umPassword) {
      umPassword.value = "";
      umPassword.disabled = true;
    }

    if (umFullName) umFullName.value = u.full_name || "";

    // Email locked on edit to avoid mismatch with Supabase Auth email
    if (umEmail) {
      umEmail.value = u.email || "";
      umEmail.readOnly = true;
      umEmail.title = "Email is locked to avoid mismatch with Supabase Auth. (Change-email flow can be added later.)";
    }

    if (umRole) umRole.value = u.role || "agent";
    if (umStatus) umStatus.value = u.status || "active";
    renderPerms(u.permissions || {});

    // Only ADMIN can change role/status
    applyRoleControls();

    showEditPanel();
    setMsg("Editing user — update name/permissions (and role/status if admin), then Save.");
  }

  function buildRowHTML(u) {
    const id = escapeHtml(u.id);
    const name = escapeHtml((u.full_name || "").trim() || "Unnamed");
    const email = escapeHtml((u.email || "").trim() || "—");

    const roleRaw = ((u.role || "").trim() || "—").toLowerCase();
    const roleLabel = roleRaw === "admin" ? "ADMIN" : (roleRaw === "agent" ? "USER" : roleRaw.toUpperCase());

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
          <button data-action="delete" type="button" class="btn-danger">Delete</button>
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

      // SINGLE DELETE: deletes BOTH Auth user + agent_users row (irreversible)
      if (action === "delete") {
        const label = (u.full_name || u.email || "this user").trim();

        const ok = await confirmExact(
          `Delete ${label}?\n\nThis will permanently delete this user and prevent them from logging in again.\n\nThis action cannot be undone.`
        );
        if (!ok) return;

const { data: sessionData, error: sessionErr } =
  await supabaseClient.auth.getSession();

if (!sessionData?.session) {
  await supabaseClient.auth.refreshSession();
}

const { data: freshSession } =
  await supabaseClient.auth.getSession();

const accessToken = freshSession?.session?.access_token;

if (!accessToken) {
  setMsg("Session expired. Please log in again.");
  return;
}


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
  "Authorization": `Bearer ${accessToken}`,
  "apikey": window.SUPABASE_ANON_KEY
},

            body: JSON.stringify({
              auth_user_id: u.auth_user_id,
              agent_user_id: u.id
            })
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

      if (!email) { setMsg("Email is required (this is the login ID)."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg("Please enter a valid email address."); return; }

      // Enforce role rules (UI + hard client-side)
      const role = admin ? roleFromUI : "agent";
      const status = admin ? statusFromUI : "active";
// CONFIRM before inactivating a user
if (
  admin &&
  !addingNew &&
  status === "inactive"
) {
  const ok = await confirmExact(
    "Set this user to INACTIVE?\n\nThey will be immediately signed out and will not be able to log in again unless reactivated."
  );
  if (!ok) return;
}

      // ADD
      if (addingNew) {
        umSaveBtn.disabled = true;
         umSaveBtn.textContent = "Saving…";
        const password = (umPassword?.value || "").trim();
        if (!password || password.length < 8) {
          setMsg("Password is required for new users (min 8 chars).");
          return;
        }

        await supabaseClient.auth.refreshSession();
const { data: { session } } = await supabaseClient.auth.getSession();

if (!session || !session.access_token) {
  setMsg("Session expired. Please log in again.");
  return;
}

const accessToken = session.access_token;


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
          setMsg("Create user failed: network error.");
          umSaveBtn.disabled = false;
          umSaveBtn.textContent = originalSaveLabel;

          return;
        }

       if (!res.ok) {
  if (res.status === 409) {
    setMsg("Email already exists.");
  } else if (res.status === 403) {
    setMsg("Permission denied.");
  } else {
    setMsg(`Create user failed (${res.status}).`);
  }
         umSaveBtn.disabled = false;
umSaveBtn.textContent = originalSaveLabel;

  return;
}


        setMsg("User created ✅");
        clearForm();
        showViewUsersPanel();
        await runSearch("");
        umSaveBtn.disabled = false;

        return;
      }

      // EDIT
      if (!editingId) { setMsg("No user selected."); return; }

      // Email is locked (do not update email here)
      const patch = admin
        ? { full_name, role, status, permissions }
        : { full_name, permissions };

      const { data, error } = await supabaseClient
        .from("agent_users")
        .update(patch)
        .eq("id", editingId)
        .select("id");

      if (error) { setMsg("Update error: " + error.message); return; }
      if (!data || data.length === 0) { setMsg("Update blocked (RLS) — no rows updated."); return; }

      umSaveBtn.textContent = originalSaveLabel;

      setMsg("Saved ✅");
      clearForm();
      showViewUsersPanel();
      await runSearch(umSearch?.value || "");

      umSaveBtn.disabled = false;
umSaveBtn.textContent = originalSaveLabel;

    });
  }

  // Ensure controls are correct even before any click
  applyRoleControls();

  return {
    resetUserScreen,
    loadUsers: async () => { showViewUsersPanel(); await runSearch(""); }
  };
}
