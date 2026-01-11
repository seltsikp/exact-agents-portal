console.log("EXACT Agents Portal loaded (v11)");

const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

window.addEventListener("DOMContentLoaded", () => {
  // Auth UI
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const authMsg = document.getElementById("authMsg");

  // Status UI
  const statusBox = document.getElementById("statusBox");
  const statusUser = document.getElementById("statusUser");
  const statusRole = document.getElementById("statusRole");
  const statusAgent = document.getElementById("statusAgent");

  // App UI
  const appBox = document.getElementById("appBox");
  const customerList = document.getElementById("customerList");
  const custMsg = document.getElementById("custMsg");
  const addCustomerBtn = document.getElementById("addCustomerBtn");
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const custEmailInput = document.getElementById("custEmail");
  const custPhoneInput = document.getElementById("custPhone");

  // Admin agent picker
  const adminAgentPicker = document.getElementById("adminAgentPicker");
  const agentSelect = document.getElementById("agentSelect");

  let currentSession = null;          // session object when logged in
  let currentProfile = null;          // agent_users row
  let currentAgentIdForInsert = null; // agent inserts use own agent_id; admin picks
  let hydratedUserId = null;

  const setAuthMsg = (t) => (authMsg.textContent = t || "");
  const setCustMsg = (t) => (custMsg.textContent = t || "");

  function setLoggedOutUI(message = "Not logged in") {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    statusBox.style.display = "none";
    appBox.style.display = "none";
    adminAgentPicker.style.display = "none";
    statusUser.textContent = "";
    statusRole.textContent = "";
    statusAgent.textContent = "";
    customerList.innerHTML = "";
    setAuthMsg(message);
    setCustMsg("");
    currentSession = null;
    currentProfile = null;
    currentAgentIdForInsert = null;
    hydratedUserId = null;
  }

  function setLoggedInShell(session) {
    currentSession = session;

    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    statusBox.style.display = "block";
    appBox.style.display = "block";

    statusUser.textContent = session.user.email || "";
    setAuthMsg("Logged in ✅");
  }

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

  async function loadCustomers() {
    customerList.innerHTML = "";
    setCustMsg("");

    const { data, error } = await supabaseClient
      .from("customers")
      .select("id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setCustMsg("Load customers error: " + error.message);
      return;
    }

    data.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.first_name} ${c.last_name} — ${c.email || ""} ${c.phone || ""}`;
      customerList.appendChild(li);
    });
  }

async function hydrateAfterLogin(session) {
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

      statusRole.textContent = profile.role || "";

      const agentName = await loadAgentName(profile.agent_id);
      statusAgent.textContent = agentName || (profile.role === "admin" ? "(admin – all agents)" : "");

      if (profile.role === "admin") {
        adminAgentPicker.style.display = "block";
        await loadAgentsForAdminPicker();
      } else {
        adminAgentPicker.style.display = "none";
        currentAgentIdForInsert = profile.agent_id;
      }

      await loadCustomers();
    } catch (e) {
      console.error("hydrateAfterLogin error:", e);
      setAuthMsg("Error after login: " + (e?.message || "Unknown error"));
    }
  }

  // Login (NO getSession call here)
  loginBtn.addEventListener("click", async () => {
    setAuthMsg("Logging in…");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

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

      // Use the returned session (critical for Edge stability)
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

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    setLoggedOutUI("Logged out");
  });

  // Add customer
  addCustomerBtn.addEventListener("click", async () => {
    setCustMsg("");

    if (!currentAgentIdForInsert) {
      setCustMsg("No agent selected/available for insert.");
      return;
    }

    const first_name = firstNameInput.value.trim();
    const last_name = lastNameInput.value.trim();
    const email = custEmailInput.value.trim() || null;
    const phone = custPhoneInput.value.trim() || null;

    if (!first_name || !last_name) {
      setCustMsg("First and last name are required.");
      return;
    }

    const { error } = await supabaseClient
      .from("customers")
      .insert([{ agent_id: currentAgentIdForInsert, first_name, last_name, email, phone }]);

    if (error) {
      setCustMsg("Insert error: " + error.message);
      return;
    }

    firstNameInput.value = "";
    lastNameInput.value = "";
    custEmailInput.value = "";
    custPhoneInput.value = "";

    await loadCustomers();
  });

  // Initial restore (ONE call only)
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

  // Auth events: update shell only (NO refresh loops)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth state change:", event);
    if (event === "SIGNED_OUT") setLoggedOutUI("Logged out");
    if (event === "SIGNED_IN" && session) hydrateAfterLogin(session);
  });
});
