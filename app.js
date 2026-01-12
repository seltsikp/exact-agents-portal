console.log("EXACT Agents Portal loaded (v25");

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

    data.forEach((a) => {
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

  // Premium customer row builder
  function buildCustomerRow(c) {
    const row = document.createElement("div");
    row.className = "cust-row";

    const left = document.createElement("div");
    left.className = "cust-left";

    const nameEl = document.createElement("div");
    nameEl.className = "cust-name";
    nameEl.textContent = `${c.first_name || ""} ${c.last_name || ""}`.trim();

    const detailsEl = document.createElement("div");
    detailsEl.className = "cust-details";
    const emailText = (c.email || "").trim();
    const phoneText = (c.phone || "").trim();
    detailsEl.textContent = [emailText, phoneText].filter(Boolean).join(" • ");

    left.appendChild(nameEl);
    if (detailsEl.textContent) left.appendChild(detailsEl);

    if (currentProfile?.role === "admin") {
      const clinicName = agentNameMap[c.agent_id] || "Unknown clinic";
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = `Clinic: ${clinicName}`;
      left.appendChild(pill);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "btn-small";
    editBtn.addEventListener("click", () => openEditCustomer(c));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn-small btn-danger";
    deleteBtn.addEventListener("click", async () => {
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
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(left);
    row.appendChild(actions);

    return row;
  }

  async function loadCustomers() {
    if (!customerList) return;

    customerList.innerHTML = "";
    setCustMsg("");

    const { data, error } = await supabaseClient
      .from("customers")
      .select("id, agent_id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setCustMsg("Load customers error: " + error.message);
      return;
    }

    (data || []).forEach((c) => {
      const li = document.createElement("li");
      li.appendChild(buildCustomerRow(c));
      customerList.appendChild(li);
    });
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

      if (!first_name || !last_name) {
        setCustMsg("First and last name are required.");
        return;
      }

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
