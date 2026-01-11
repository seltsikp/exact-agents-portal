console.log("EXACT Agents Portal loaded (v10)");

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

  let currentUser = null;
  let currentProfile = null; // row from agent_users
  let currentAgentIdForInsert = null; // agent inserts always use their agent_id; admin chooses

  function setAuthMsg(t) {
    authMsg.textContent = t || "";
  }

  function setCustMsg(t) {
    custMsg.textContent = t || "";
  }

  function setLoggedOutUI() {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    statusBox.style.display = "none";
    appBox.style.display = "none";
    adminAgentPicker.style.display = "none";
    statusUser.textContent = "";
    statusRole.textContent = "";
    statusAgent.textContent = "";
    customerList.innerHTML = "";
    setAuthMsg("Not logged in");
    setCustMsg("");
    currentUser = null;
    currentProfile = null;
    currentAgentIdForInsert = null;
  }

  function setLoggedInUI() {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    statusBox.style.display = "block";
    appBox.style.display = "block";
    setAuthMsg("");
  }

  async function loadProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user || null;
    if (!currentUser) return null;

    const { data, error } = await supabaseClient
      .from("agent_users")
      .select("agent_id, role, status, email, full_name")
      .eq("auth_user_id", currentUser.id)
      .single();

    if (error) throw error;
    if (!data || data.status !== "active") return null;

    currentProfile = data;
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

    data.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      agentSelect.appendChild(opt);
    });

    // Default selection
    if (agentSelect.options.length > 0) {
      currentAgentIdForInsert = agentSelect.value;
    }

    agentSelect.addEventListener("change", () => {
      currentAgentIdForInsert = agentSelect.value;
    });
  }

  async function loadCustomers() {
    customerList.innerHTML = "";
    setCustMsg("");

    const { data, error } = await supabaseClient
      .from("customers")
      .select("id, first_name, last_name, email, phone, agent_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setCustMsg("Load customers error: " + error.message);
      return;
    }

    data.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.first_name} ${c.last_name} — ${c.email || ""} ${c.phone || ""}`;
      customerList.appendChild(li);
    });
  }

  async function refreshApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      setLoggedOutUI();
      return;
    }

    setLoggedInUI();

    // Load profile (agent_users)
    let profile;
    try {
      profile = await loadProfile();
      if (!profile) {
        setAuthMsg("No active profile in agent_users for this login.");
        return;
      }
    } catch (e) {
      setAuthMsg("Profile load error: " + e.message);
      return;
    }

    // Status
    statusUser.textContent = session.user.email || "";
    statusRole.textContent = profile.role || "";
    const agentName = await loadAgentName(profile.agent_id);
    statusAgent.textContent = agentName || (profile.role === "admin" ? "(admin – all agents)" : "");

    // Insert agent_id logic
    if (profile.role === "admin") {
      adminAgentPicker.style.display = "block";
      await loadAgentsForAdminPicker();
      // currentAgentIdForInsert comes from picker
    } else {
      adminAgentPicker.style.display = "none";
      currentAgentIdForInsert = profile.agent_id;
    }

    // Load customers (RLS will scope automatically for agents)
    await loadCustomers();
  }

  // Login
  loginBtn.addEventListener("click", async () => {
    setAuthMsg("Logging in…");
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setAuthMsg("Enter email + password.");
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthMsg("Login failed: " + error.message);
      return;
    }

    await refreshApp();
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    setLoggedOutUI();
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

  // On load
  refreshApp();

  // Keep UI in sync with auth changes
  supabaseClient.auth.onAuthStateChange(() => refreshApp());
});
