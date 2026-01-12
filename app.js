console.log("EXACT Agents Portal loaded (v26)");

// NOTE: Supabase anon key is public by design. RLS protects data.
const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

// Supabase client (Edge-friendly settings)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

window.addEventListener("DOMContentLoaded", () => {
  // Helper: safe show/hide
  function show(el, isVisible) {
    if (!el) return;
    el.style.display = isVisible ? "block" : "none";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateShort(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  }

  // Build premium row HTML (customer list)
  function buildCustomerRowHTML(c, { role, agentNameMap }) {
    const id = escapeHtml(c.id);

    const first = (c.first_name ?? "").trim();
    const last = (c.last_name ?? "").trim();
    const fullName = `${first} ${last}`.trim() || "Unnamed Customer";

    const name = escapeHtml(fullName);
    const email = escapeHtml((c.email || "").trim());
    const phone = escapeHtml((c.phone || "").trim());
    const created = formatDateShort(c.created_at);

    let metaLine = "";
    if (email && phone) metaLine = `<span>${email}</span><span class="customer-dot">•</span><span>${phone}</span>`;
    else if (email) metaLine = `<span>${email}</span>`;
    else if (phone) metaLine = `<span>${phone}</span>`;
    else metaLine = `<span style="opacity:.65;">No contact details</span>`;

    // Admin clinic pill
    let clinicPill = "";
    if (role === "admin") {
      const clinicName = agentNameMap?.[c.agent_id] || "Unknown clinic";
      clinicPill = `<span class="pill-soft pill-soft-gold">Clinic: ${escapeHtml(clinicName)}</span>`;
    }

    const createdPill = created ? `<span class="pill-soft">Created: ${escapeHtml(created)}</span>` : "";

    return `
      <div class="customer-row" data-customer-id="${id}">
        <div class="customer-main">
          <div class="name">${name}</div>
          <div class="meta">${metaLine}</div>
        </div>

        <div class="customer-context">
          ${clinicPill}
          ${createdPill}
        </div>

        <div class="customer-actions">
          <button class="btn btn-primary" data-action="edit" type="button">Edit</button>
          <button class="btn btn-danger" data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

  // Confirm dialog helper (custom <dialog> with fallback)
  async function confirmExact(message) {
    const dlg = document.getElementById("confirmDialog");
    const txt = document.getElementById("confirmDialogText");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    if (!dlg || typeof dlg.showModal !== "function") {
      return confirm(message);
    }

    txt.textContent = message;

    return await new Promise((resolve) => {
      const cleanup = () => {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        dlg.removeEventListener("cancel", onCancel);
        dlg.close();
      };

      const onOk = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      dlg.addEventListener("cancel", onCancel);

      dlg.showModal();
    });
  }

  function isValidEmail(email) {
  if (!email) return true; // optional
  const e = email.trim();
  if (e.includes(" ")) return false;
  const at = e.indexOf("@");
  if (at < 1) return false;
  const dot = e.lastIndexOf(".");
  return dot > at + 1 && dot < e.length - 1;
}

function isValidPhone(phone) {
  if (!phone) return true; // optional
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 7;
}

  function markField(el, state) {
  if (!el) return;
  el.classList.remove("field-error", "field-ok");
  if (state === "error") el.classList.add("field-error");
  if (state === "ok") el.classList.add("field-ok");
}

function clearFieldMarks(...els) {
  els.forEach(el => {
    if (!el) return;
    el.classList.remove("field-error", "field-ok");
  });
}

function isValidEmail(email) {
  if (!email) return true; // optional
  const e = email.trim();
  if (e.includes(" ")) return false;
  const at = e.indexOf("@");
  if (at < 1) return false;
  const dot = e.lastIndexOf(".");
  return dot > at + 1 && dot < e.length - 1;
}

function isValidPhone(phone) {
  if (!phone) return true; // optional
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 7;
}

  // --- UI elements ---
  const loginBox = document.getElementById("loginBox");
  const topBar = document.getElementById("topBar");
  const topBarTitle = document.getElementById("topBarTitle");
  const topBarSub = document.getElementById("topBarSub");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const authMsg = document.getElementById("authMsg");

  const appBox = document.getElementById("appBox");

  // Menu + Views
  const menuItems = document.getElementById("menuItems");
  const viewAgentMgmt = document.getElementById("viewAgentMgmt");
  const viewCustomerMgmt = document.getElementById("viewCustomerMgmt");
  const viewLabMgmt = document.getElementById("viewLabMgmt");

  // Agents view
  const agentList = document.getElementById("agentList");
  const agentMsg = document.getElementById("agentMsg");

  // Admin-only agent picker (inside customer view)
  const adminAgentPicker = document.getElementById("adminAgentPicker");
  const agentSelect = document.getElementById("agentSelect");

  // Customers
  const customerList = document.getElementById("customerList");
  const custMsg = document.getElementById("custMsg");

  const openAddCustomerBtn = document.getElementById("openAddCustomerBtn");
  const cancelAddCustomerBtn = document.getElementById("cancelAddCustomerBtn");
  const addCustomerPanel = document.getElementById("addCustomerPanel");
  const addCustomerBtn = document.getElementById("addCustomerBtn");

  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const custEmailInput = document.getElementById("custEmail");
  const custPhoneInput = document.getElementById("custPhone");

  // --- State ---
  let currentSession = null;
  let currentProfile = null;
  let currentAgentIdForInsert = null;
  let hydratedUserId = null;

  let editingCustomerId = null;

  // agent map (id -> name) for admin customer display
  let agentNameMap = {};

  // customers cache for event delegation (id -> customer object)
  let customersById = {};

  // UI state
  let activeViewKey = null;

  const setAuthMsg = (t) => {
    if (!authMsg) return;
    authMsg.textContent = t || "";
  };

  const setCustMsg = (t) => {
    if (!custMsg) return;
    custMsg.textContent = t || "";
  };

  const setAgentMsg = (t) => {
    if (!agentMsg) return;
    agentMsg.textContent = t || "";
  };

  // --- Add customer toggle helpers ---
  function openAddCustomer() {
    show(addCustomerPanel, true);
    show(openAddCustomerBtn, false);
    show(cancelAddCustomerBtn, true);
  }

  function closeAddCustomer() {
    show(addCustomerPanel, false);
    show(openAddCustomerBtn, true);
    show(cancelAddCustomerBtn, false);

    if (firstNameInput) firstNameInput.value = "";
    if (lastNameInput) lastNameInput.value = "";
    if (custEmailInput) custEmailInput.value = "";
    if (custPhoneInput) custPhoneInput.value = "";

    editingCustomerId = null;
    if (addCustomerBtn) addCustomerBtn.textContent = "Save customer";
  }

  function openEditCustomer(customer) {
    if (!customer) return;

    editingCustomerId = customer.id;

    if (firstNameInput) firstNameInput.value = customer.first_name || "";
    if (lastNameInput) lastNameInput.value = customer.last_name || "";
    if (custEmailInput) custEmailInput.value = customer.email || "";
    if (custPhoneInput) custPhoneInput.value = customer.phone || "";

    if (addCustomerBtn) addCustomerBtn.textContent = "Save changes";
    openAddCustomer();
  }

  if (openAddCustomerBtn) openAddCustomerBtn.addEventListener("click", () => {
    editingCustomerId = null;
    if (addCustomerBtn) addCustomerBtn.textContent = "Save customer";
    openAddCustomer();
  });

  if (cancelAddCustomerBtn) cancelAddCustomerBtn.addEventListener("click", closeAddCustomer);

  // --- UI: logged out ---
  function setLoggedOutUI(message = "Not logged in") {
    show(topBar, false);
    show(loginBox, true);
    show(appBox, false);
    show(adminAgentPicker, false);

    if (topBarTitle) topBarTitle.textContent = "";
    if (topBarSub) topBarSub.textContent = "";

    if (customerList) customerList.innerHTML = "";
    if (agentList) agentList.innerHTML = "";
    if (menuItems) menuItems.innerHTML = "";

    closeAddCustomer();

    setAuthMsg(message);
    setCustMsg("");
    setAgentMsg("");

    currentSession = null;
    currentProfile = null;
    currentAgentIdForInsert = null;
    hydratedUserId = null;
    agentNameMap = {};
    customersById = {};
    activeViewKey = null;

    show(viewAgentMgmt, false);
    show(viewCustomerMgmt, false);
    show(viewLabMgmt, false);
  }

  function setLoggedInShell(session) {
    currentSession = session;

    show(loginBox, false);
    show(topBar, true);
    show(appBox, true);

    closeAddCustomer();
    setAuthMsg("Logged in ✅");
  }

  // --- Data loaders ---
  async function loadProfileForUser(userId) {
    const { data, error } = await supabaseClient
      .from("agent_users")
      .select("agent_id, role, status, email, full_name")
      .eq("auth_user_id", userId)
      .single();

    if (error) throw error;
    if (!data || data.status !== "active") return null;
    return data;
  }

  async function loadAgentName(agentId) {
    if (!agentId) return "";
    const { data, error } = await supabaseClient
      .from("agents")
      .select("name")
      .eq("id", agentId)
      .single();

    if (error) return "";
    return data?.name || "";
  }

  async function loadAgentsForAdminPicker() {
    if (!agentSelect) return;

    agentSelect.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) throw error;

    (data || []).forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      agentSelect.appendChild(opt);
    });

    if (agentSelect.options.length > 0) {
      currentAgentIdForInsert = agentSelect.value;
    }

    agentSelect.onchange = () => {
      currentAgentIdForInsert = agentSelect.value;
    };
  }

  async function loadAgentNameMap() {
    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name");

    if (error) {
      console.warn("Could not load agent map:", error.message);
      agentNameMap = {};
      return;
    }

    agentNameMap = {};
    (data || []).forEach((a) => {
      agentNameMap[a.id] = a.name;
    });
  }

  async function loadAgentsList() {
    if (!agentList) return;

    agentList.innerHTML = "";
    setAgentMsg("");

    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setAgentMsg("Load agents error: " + error.message);
      return;
    }

    (data || []).forEach((a) => {
      const li = document.createElement("li");

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.gap = "4px";

      const name = document.createElement("div");
      name.style.fontWeight = "600";
      name.textContent = a.name || "(Unnamed agent)";

      const sub = document.createElement("div");
      sub.className = "subtle";
      sub.textContent = a.id; // later we’ll replace with nicer metadata

      left.appendChild(name);
      left.appendChild(sub);

      li.appendChild(left);
      agentList.appendChild(li);
    });
  }

  // Customer list actions (event delegation) — attach once
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
        openEditCustomer(c);
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

        if (error) {
          setCustMsg("Delete error: " + error.message);
          return;
        }

        if (!data || data.length === 0) {
          setCustMsg("Delete blocked (RLS) — no rows deleted.");
          return;
        }

        setCustMsg("Deleted ✅");

        if (editingCustomerId === c.id) {
          closeAddCustomer();
        }

        await loadCustomers();
      }
    });

    customerList.dataset.bound = "1";
  }

  async function loadCustomers() {
    if (!customerList) return;

    ensureCustomerListDelegation();

    customerList.innerHTML = "";
    customersById = {};
    setCustMsg("");

    const { data, error } = await supabaseClient
      .from("customers")
      .select("id, agent_id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setCustMsg("Load customers error: " + error.message);
      return;
    }

    const role = currentProfile?.role || "agent";

    (data || []).forEach((c) => {
      customersById[c.id] = c;
    });

    // Render as premium rows (no <li>)
    customerList.innerHTML = (data || [])
      .map((c) => buildCustomerRowHTML(c, { role, agentNameMap }))
      .join("");
  }

  // --- Menu + views ---
  function setActiveView(viewKey) {
    activeViewKey = viewKey;

    show(viewAgentMgmt, viewKey === "agents");
    show(viewCustomerMgmt, viewKey === "customers");
    show(viewLabMgmt, viewKey === "lab");

    // highlight active button
    if (menuItems) {
      const btns = menuItems.querySelectorAll("button[data-view]");
      btns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-view") === viewKey));
    }

    // lazy-load per view
    if (viewKey === "agents") {
      loadAgentsList();
    }
    if (viewKey === "customers") {
      loadCustomers();
    }
    // lab is placeholder for now
  }

  function renderMenuForRole(role) {
    if (!menuItems) return;
    menuItems.innerHTML = "";

    const addMenuBtn = (label, viewKey) => {
      const b = document.createElement("button");
      b.className = "menuBtn";
      b.textContent = label;
      b.setAttribute("data-view", viewKey);
      b.addEventListener("click", () => setActiveView(viewKey));
      menuItems.appendChild(b);
    };

    if (role === "admin") {
      addMenuBtn("Agent Management", "agents");
      addMenuBtn("Customer Management", "customers");
      addMenuBtn("Lab Management", "lab");
      setActiveView("customers"); // default landing for admin
      return;
    }

    // Agent role (for now)
    addMenuBtn("Customer Management", "customers");
    setActiveView("customers");
  }

  // --- Hydration ---
  async function hydrateAfterLogin(session) {
    if (!session?.user?.id) return;

    if (hydratedUserId === session.user.id) return;
    hydratedUserId = session.user.id;

    try {
      setLoggedInShell(session);

      const profile = await loadProfileForUser(session.user.id);
      if (!profile) {
        setAuthMsg("No active profile in agent_users for this login.");
        return;
      }
      currentProfile = profile;

      // top bar
      if (profile.role === "admin") {
        if (topBarTitle) topBarTitle.textContent = "Admin";
        if (topBarSub) topBarSub.textContent = session.user.email || "";

        show(adminAgentPicker, true);
        await loadAgentsForAdminPicker();
        await loadAgentNameMap();
      } else {
        const agentName = await loadAgentName(profile.agent_id);
        if (topBarTitle) topBarTitle.textContent = `Agent — ${agentName || "Unknown clinic"}`;
        if (topBarSub) topBarSub.textContent = session.user.email || "";

        show(adminAgentPicker, false);
        currentAgentIdForInsert = profile.agent_id;
        agentNameMap = {};
      }

      renderMenuForRole(profile.role);
      closeAddCustomer();
    } catch (e) {
      console.error("hydrateAfterLogin error:", e);
      setAuthMsg("Error after login: " + (e?.message || "Unknown error"));
    }
  }

  // --- Login ---
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      setAuthMsg("Logging in…");

      const email = (emailInput?.value || "").trim();
      const password = passwordInput?.value || "";

      if (!email || !password) {
        setAuthMsg("Enter email + password.");
        return;
      }

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthMsg("Login failed: " + error.message);
          return;
        }

        if (!data?.session) {
          setAuthMsg("Login succeeded but session missing.");
          return;
        }

        await hydrateAfterLogin(data.session);
      } catch (e) {
        console.error("Login crashed:", e);
        setAuthMsg("Login crashed: " + (e?.message || "Unknown error"));
      }
    });
  }

  // --- Logout ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      setLoggedOutUI("Logged out");
    });
  }

  // --- Add / Edit customer ---
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener("click", async () => {
      setCustMsg("");

      const first_name = (firstNameInput?.value || "").trim();
      const last_name = (lastNameInput?.value || "").trim();
      const email = (custEmailInput?.value || "").trim() || null;
      const phone = (custPhoneInput?.value || "").trim() || null;
      if (email && !isValidEmail(email)) {
  setCustMsg("Please enter a valid email address.");
  return;
}

if (phone && !isValidPhone(phone)) {
  setCustMsg("Please enter a valid phone number.");
  return;
}


     // clear previous field states
clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);

// Required fields
if (!first_name) {
  markField(firstNameInput, "error");
  setCustMsg("First name is required.");
  return;
}
markField(firstNameInput, "ok");

if (!last_name) {
  markField(lastNameInput, "error");
  setCustMsg("Last name is required.");
  return;
}
markField(lastNameInput, "ok");

// Optional fields (validate only if entered)
if (email && !isValidEmail(email)) {
  markField(custEmailInput, "error");
  setCustMsg("Please enter a valid email address.");
  return;
}
if (email) markField(custEmailInput, "ok");

if (phone && !isValidPhone(phone)) {
  markField(custPhoneInput, "error");
  setCustMsg("Please enter a valid phone number.");
  return;
}
if (phone) markField(custPhoneInput, "ok");


      // EDIT MODE
      if (editingCustomerId) {
        const { data, error } = await supabaseClient
          .from("customers")
          .update({ first_name, last_name, email, phone })
          .eq("id", editingCustomerId)
          .select("id");

        if (error) {
          setCustMsg("Update error: " + error.message);
          return;
        }

        if (!data || data.length === 0) {
          setCustMsg("Update blocked (RLS) — no rows updated.");
          return;
        }

        setCustMsg("Saved ✅");
        await loadCustomers();
        closeAddCustomer();
        return;
      }

      // ADD MODE
      if (!currentAgentIdForInsert) {
        setCustMsg("No agent selected/available for insert.");
        return;
      }

      const { error } = await supabaseClient
        .from("customers")
        .insert([{ agent_id: currentAgentIdForInsert, first_name, last_name, email, phone }]);

      if (error) {
        setCustMsg("Insert error: " + error.message);
        return;
      }

      await loadCustomers();
      closeAddCustomer();
    });
  }

  // --- Initial restore ---
  (async () => {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        setLoggedOutUI("Session restore error: " + error.message);
        return;
      }
      if (data?.session) {
        await hydrateAfterLogin(data.session);
      } else {
        setLoggedOutUI("Not logged in");
      }
    } catch (e) {
      console.error("Initial restore crashed:", e);
      setLoggedOutUI("Session restore crashed: " + (e?.message || "Unknown error"));
    }
  })();

  // --- Auth state events ---
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth state change:", event);
    if (event === "SIGNED_OUT") setLoggedOutUI("Logged out");
    if (event === "SIGNED_IN" && session) hydrateAfterLogin(session);
  });
});
