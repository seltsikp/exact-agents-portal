import { showWelcomePanel } from "./modules/welcome.js";
import { initNavigation } from "./modules/navigation.js";
import { initCustomerManagement } from "./modules/customers.js";
import { initAgentManagement } from "./modules/agents.js";
import { initLabManagement } from "./modules/labs.js";
import { initProductTypesManagement } from "./modules/productTypes.js";


console.log("EXACT Agents Portal loaded (v42)");

// =========================================================
// BLOCK: SUPABASE CLIENT
// =========================================================
const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co";
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

  // =========================================================
  // BLOCK: HELPERS
  // =========================================================
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

  // =========================================================
  // BLOCK: CONFIRM DIALOG
  // =========================================================
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

  // =========================================================
  // BLOCK: VALIDATION
  // =========================================================
  function isValidEmail(email) {
    if (!email) return true;
    const e = email.trim();
    if (e.includes(" ")) return false;
    const at = e.indexOf("@");
    if (at < 1) return false;
    const dot = e.lastIndexOf(".");
    return dot > at + 1 && dot < e.length - 1;
  }

  function isValidPhone(phone) {
    if (!phone) return true;
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

  // =========================================================
  // BLOCK: UI ELEMENTS (DOM REFERENCES)
  // =========================================================
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
  const menuItems = document.getElementById("menuItems");

  // Views
  const viewWelcome = document.getElementById("viewWelcome");
  const welcomeContent = document.getElementById("welcomeContent");
  const viewCustomerMgmt = document.getElementById("viewCustomerMgmt");
  const viewAgentMgmt = document.getElementById("viewAgentMgmt");
   const viewFormulary = document.getElementById("viewFormulary");
  const viewLabMgmt = document.getElementById("viewLabMgmt");
  const viewProductTypes = document.getElementById("viewProductTypes");



  // Customer Mgmt UI
  const cmViewBtn = document.getElementById("cmViewBtn");
  const cmAddBtn = document.getElementById("cmAddBtn");
  const cmClearBtn = document.getElementById("cmClearBtn");
  const custMsg = document.getElementById("custMsg");

  const cmViewPanel = document.getElementById("cmViewPanel");
  const cmAddPanel = document.getElementById("cmAddPanel");

  const cmSearch = document.getElementById("cmSearch");
  const cmSearchBtn = document.getElementById("cmSearchBtn");
  const cmShowAllBtn = document.getElementById("cmShowAllBtn");

  const customerList = document.getElementById("customerList");

  // Lab Mgmt UI
  const lmViewBtn = document.getElementById("lmViewBtn");
  const lmAddBtn = document.getElementById("lmAddBtn");
  const lmClearBtn = document.getElementById("lmClearBtn");
  const labMsg = document.getElementById("labMsg");
  const lmViewPanel = document.getElementById("lmViewPanel");
  const lmAddPanel = document.getElementById("lmAddPanel");
  const labList = document.getElementById("labList");

  const lmName = document.getElementById("lmName");
  const lmEmail = document.getElementById("lmEmail");
  const lmOrdersEmail = document.getElementById("lmOrdersEmail");
  const lmPhone = document.getElementById("lmPhone");
  const lmAddress = document.getElementById("lmAddress");
  const lmShipping = document.getElementById("lmShipping");
  const lmSaveBtn = document.getElementById("lmSaveBtn");

  // Agent Mgmt UI
  const amViewBtn = document.getElementById("amViewBtn");
  const amAddBtn = document.getElementById("amAddBtn");
  const amClearBtn = document.getElementById("amClearBtn");
  const agentMsg = document.getElementById("agentMsg");

  const amViewPanel = document.getElementById("amViewPanel");
  const amAddPanel = document.getElementById("amAddPanel");

  const amSearch = document.getElementById("amSearch");
  const amSearchBtn = document.getElementById("amSearchBtn");
  const amShowAllBtn = document.getElementById("amShowAllBtn");

  const agentList = document.getElementById("agentList");

  const agentNameInput = document.getElementById("agentName");
  const addAgentBtn = document.getElementById("addAgentBtn");

  // Add customer fields
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const custEmailInput = document.getElementById("custEmail");
  const custPhoneInput = document.getElementById("custPhone");
  const addCustomerBtn = document.getElementById("addCustomerBtn");

  // Clinic assignment
  const assignClinicRow = document.getElementById("assignClinicRow");
  const assignClinicSelect = document.getElementById("assignClinicSelect");
  const agentClinicRow = document.getElementById("agentClinicRow");
  const agentClinicName = document.getElementById("agentClinicName");

  // Formulary tabs
  const fxTabIngredients = document.getElementById("fxTabIngredients");
  const fxTabProducts = document.getElementById("fxTabProducts");

  const fxSectionIngredients = document.getElementById("fxSectionIngredients");
  const fxSectionProducts = document.getElementById("fxSectionProducts");

  // Ingredients UI
  const fxIngViewBtn = document.getElementById("fxIngViewBtn");
  const fxIngAddBtn = document.getElementById("fxIngAddBtn");
  const fxIngClearBtn = document.getElementById("fxIngClearBtn");
  const fxIngMsg = document.getElementById("fxIngMsg");

  const fxIngViewPanel = document.getElementById("fxIngViewPanel");
  const fxIngAddPanel = document.getElementById("fxIngAddPanel");

  const fxIngSearch = document.getElementById("fxIngSearch");
  const fxIngSearchBtn = document.getElementById("fxIngSearchBtn");
  const fxIngShowAllBtn = document.getElementById("fxIngShowAllBtn");

  const fxIngList = document.getElementById("fxIngList");

  const fxIngPsi = document.getElementById("fxIngPsi");
  const fxIngInci = document.getElementById("fxIngInci");
  const fxIngDesc = document.getElementById("fxIngDesc");
  const fxIngSaveBtn = document.getElementById("fxIngSaveBtn");

  // Product Types view + UI
  const viewProductTypes = document.getElementById("viewProductTypes");
  const ptCode = document.getElementById("pt_code");
  const ptName = document.getElementById("pt_name");
  const ptAddBtn = document.getElementById("pt_addBtn");
  const ptTbody = document.getElementById("pt_tbody");
  const ptStatus = document.getElementById("pt_status");

  // =========================================================
  // BLOCK: STATE
  // =========================================================
  let currentSession = null;
  let currentProfile = null;
  let hydratedUserId = null;

  let agentNameMap = {};
  let customersById = {};
  let agentsById = {};

  let ingredientsById = {};
  let editingIngredientId = null;

  const setAgentMsg = (t) => { if (agentMsg) agentMsg.textContent = t || ""; };
  const setAuthMsg = (t) => { if (authMsg) authMsg.textContent = t || ""; };
  const setCustMsg = (t) => { if (custMsg) custMsg.textContent = t || ""; };
  const setFxIngMsg = (t) => { if (fxIngMsg) fxIngMsg.textContent = t || ""; };

  // =========================================================
  // BLOCK: MODULE INITS
  // =========================================================
  const customerModule = initCustomerManagement({
    supabaseClient,
    ui: {
      cmViewBtn,
      cmAddBtn,
      cmClearBtn,
      custMsg,
      cmViewPanel,
      cmAddPanel,
      cmSearch,
      cmSearchBtn,
      cmShowAllBtn,
      customerList,
      firstNameInput,
      lastNameInput,
      custEmailInput,
      custPhoneInput,
      addCustomerBtn,
      assignClinicRow,
      assignClinicSelect,
      agentClinicRow,
      agentClinicName
    },
    helpers: {
      show,
      escapeHtml,
      formatDateShort,
      confirmExact,
      isValidEmail,
      isValidPhone,
      markField,
      clearFieldMarks
    },
    state: {
      get currentProfile() { return currentProfile; },
      get agentNameMap() { return agentNameMap; }
    }
  });

  const agentModule = initAgentManagement({
    supabaseClient,
    ui: {
      amViewBtn,
      amAddBtn,
      amClearBtn,
      agentMsg,
      amViewPanel,
      amAddPanel,
      amSearch,
      amSearchBtn,
      amShowAllBtn,
      agentList,
      agentNameInput,
      addAgentBtn
    },
    helpers: {
      show,
      escapeHtml,
      formatDateShort,
      confirmExact
    },
    state: {
      async refreshAgents() {
        await loadAgentNameMap();
        await loadAgentsForAssignDropdown();
      }
    }
  });

  const labsModule = initLabManagement({
    supabaseClient,
    ui: {
      lmViewBtn,
      lmAddBtn,
      lmClearBtn,
      labMsg,
      lmViewPanel,
      lmAddPanel,
      labList,
      lmName,
      lmEmail,
      lmOrdersEmail,
      lmPhone,
      lmAddress,
      lmShipping,
      lmSaveBtn
    },
    helpers: { show, confirmExact }
  });
    const productTypesModule = initProductTypesManagement({
    supabaseClient,
    ui: { ptCode, ptName, ptAddBtn, ptTbody, ptStatus },
    helpers: { confirmExact }
  });


  // =========================================================
  // BLOCK: RESET INGREDIENTS SCREEN (MISSING BEFORE)
  // =========================================================
  function resetIngredientsScreen() {
    show(fxIngViewPanel, false);
    show(fxIngAddPanel, false);
    show(fxIngClearBtn, false);
    setFxIngMsg("");
    ingredientsById = {};
    editingIngredientId = null;

    if (fxIngSearch) fxIngSearch.value = "";
    if (fxIngPsi) fxIngPsi.value = "";
    if (fxIngInci) fxIngInci.value = "";
    if (fxIngDesc) fxIngDesc.value = "";
    if (fxIngList) fxIngList.innerHTML = "";
  }

  // =========================================================
  // BLOCK: ROW RENDERERS
  // =========================================================
  function buildIngredientRowHTML(i) {
    const id = escapeHtml(i.id);
    const psi = escapeHtml((i.psi_number || "").trim());
    const inci = escapeHtml((i.inci_name || "").trim());
    const desc = escapeHtml((i.short_description || "").trim());

    return `
      <div class="ingredient-row" data-ingredient-id="${id}">
        <div class="ingredient-cell ingredient-psi">${psi}</div>
        <div class="ingredient-cell ingredient-inci">${inci}</div>
        <div class="ingredient-cell ingredient-desc">${desc}</div>

        <div class="ingredient-actions">
          <button class="ing-link" data-action="edit" type="button">Edit</button>
          <button class="ing-link ing-delete" data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

  // =========================================================
  // BLOCK: INGREDIENT LIST DELEGATION
  // =========================================================
  function ensureIngredientListDelegation() {
    if (!fxIngList) return;
    if (fxIngList.dataset.bound === "1") return;

    fxIngList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const row = e.target.closest(".ingredient-row");
      if (!row) return;

      const ingId = row.getAttribute("data-ingredient-id");
      const action = btn.getAttribute("data-action");
      const i = ingredientsById[ingId];
      if (!i) return;

      if (action === "edit") {
        editingIngredientId = i.id;
        if (fxIngPsi) fxIngPsi.value = i.psi_number || "";
        if (fxIngInci) fxIngInci.value = i.inci_name || "";
        if (fxIngDesc) fxIngDesc.value = i.short_description || "";
        showAddIngredientPanel();
        setFxIngMsg("Editing ingredient — click Save ingredient to update.");
        return;
      }

      if (action === "delete") {
        const label =
          (i.inci_name || "").trim() ||
          (i.psi_number || "").trim() ||
          "this ingredient";

        const ok = await confirmExact(`Delete ${label}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("ingredients")
          .delete()
          .eq("id", i.id)
          .select("id");

        if (error) { setFxIngMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setFxIngMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setFxIngMsg("Deleted ✅");
        await runIngredientSearch(fxIngSearch?.value || "");
      }
    });

    fxIngList.dataset.bound = "1";
  }

  // =========================================================
  // BLOCK: SCREEN HELPERS (INGREDIENTS)
  // =========================================================
  function showViewIngredientsPanel() {
    show(fxIngViewPanel, true);
    show(fxIngAddPanel, false);
    show(fxIngClearBtn, true);

    if (fxIngList) fxIngList.className = "ingredient-list";
    if (fxIngSearch) fxIngSearch.focus();

    runIngredientSearch("");
  }

  function showAddIngredientPanel() {
    show(fxIngViewPanel, false);
    show(fxIngAddPanel, true);
    show(fxIngClearBtn, true);

    setFxIngMsg("");
    if (fxIngPsi) fxIngPsi.focus();
  }

  // =========================================================
  // BLOCK: INGREDIENT QUERY
  // =========================================================
  async function runIngredientSearch(term) {
    if (!fxIngList) return;

    ensureIngredientListDelegation();

    fxIngList.className = "ingredient-list";
    fxIngList.innerHTML = "";
    ingredientsById = {};
    setFxIngMsg("Searching…");

    let q = supabaseClient
      .from("ingredients")
      .select("id, psi_number, inci_name, short_description")
      .order("psi_number", { ascending: true });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.or([
        `psi_number.ilike.%${esc}%`,
        `inci_name.ilike.%${esc}%`,
        `short_description.ilike.%${esc}%`
      ].join(","));
    }

    const { data, error } = await q;

    if (error) { setFxIngMsg("Search error: " + error.message); return; }

    const rows = data || [];
    rows.forEach(i => { ingredientsById[i.id] = i; });

    fxIngList.innerHTML = rows.map(buildIngredientRowHTML).join("");

    if (rows.length === 0) setFxIngMsg("No matches found.");
    else setFxIngMsg(`Found ${rows.length} ingredient${rows.length === 1 ? "" : "s"}.`);
  }

  // =========================================================
  // BLOCK: AUTH + PROFILE LOOKUPS
  // =========================================================
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
    (data || []).forEach(a => { agentNameMap[a.id] = a.name; });
  }

  async function loadAgentsForAssignDropdown() {
    if (!assignClinicSelect) return;
    assignClinicSelect.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("agents")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) throw error;

    (data || []).forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      assignClinicSelect.appendChild(opt);
    });
  }

  // =========================================================
  // BLOCK: FORMULARY TABS
  // =========================================================
   function setActiveFormularyTab(tabKey) {
    fxTabIngredients?.classList.toggle("active", tabKey === "ingredients");
    fxTabProducts?.classList.toggle("active", tabKey === "products");

    show(fxSectionIngredients, tabKey === "ingredients");
    show(fxSectionProducts, tabKey === "products");
  }



  // =========================================================
  // BLOCK: VIEWS + MENU (MODULE)
  // =========================================================
  const nav = initNavigation({
    menuItems,
       views: {
      welcome: viewWelcome,
      customers: viewCustomerMgmt,
      agents: viewAgentMgmt,
      productTypes: viewProductTypes,
      labs: viewLabMgmt,
      formulary: viewFormulary
    },

    show,
    canAccess: (viewKey) => {
      if (viewKey === "agents" && currentProfile?.role !== "admin") return false;
      if (viewKey === "formulary" && currentProfile?.role !== "admin") return false;
      if (viewKey === "labs" && currentProfile?.role !== "admin") return false;
      if (viewKey === "productTypes" && currentProfile?.role !== "admin") return false;
      return true;
    },
       onEnter: {
      welcome: () => {
        showWelcomePanel({ containerEl: welcomeContent });
      },
      customers: () => {
        customerModule.resetCustomerScreen();
      },
      agents: () => {
        agentModule.resetAgentScreen();
      },
      productTypes: async () => {
        productTypesModule.resetProductTypesScreen();
        await productTypesModule.loadProductTypes();
      },
      labs: () => {
        labsModule.resetLabsScreen();
      },
      formulary: () => {
        setActiveFormularyTab("ingredients");
        resetIngredientsScreen();
      }
    }

  });

  // =========================================================
  // BLOCK: LOGIN/LOGOUT SHELL
  // =========================================================
  function setLoggedOutUI(message = "Not logged in") {
    show(topBar, false);
    show(loginBox, true);
    show(appBox, false);

    if (topBarTitle) topBarTitle.textContent = "";
    if (topBarSub) topBarSub.textContent = "";
    if (menuItems) menuItems.innerHTML = "";

    setAuthMsg(message);
    setCustMsg("");

    currentSession = null;
    currentProfile = null;
    hydratedUserId = null;

    agentNameMap = {};
    customersById = {};
    agentsById = {};

    ingredientsById = {};
    editingIngredientId = null;

    customerModule.resetCustomerScreen();
    agentModule.resetAgentScreen();
    labsModule.resetLabsScreen();
    resetIngredientsScreen();

    show(viewWelcome, false);
  }

  function setLoggedInShell(session) {
    currentSession = session;
    show(loginBox, false);
    show(topBar, true);
    show(appBox, true);
    setAuthMsg("Logged in ✅");
  }

  // =========================================================
  // BLOCK: HYDRATION (AFTER LOGIN)
  // =========================================================
  async function hydrateAfterLogin(session) {
    if (!session?.user?.id) return;

    if (hydratedUserId === session.user.id) return;
    hydratedUserId = session.user.id;

    try {
      setLoggedInShell(session);

      let profile = null;
      try {
        profile = await loadProfileForUser(session.user.id);
      } catch (e) {
        console.error("loadProfileForUser failed:", e);
      }

      if (!profile) {
        if (topBarTitle) topBarTitle.textContent = "Logged in";
        if (topBarSub) topBarSub.textContent = "Profile lookup failed (agent_users). Check RLS / row exists.";
        nav.renderMenuForRole("agent");
        nav.setActiveView("welcome");
        return;
      }

      currentProfile = profile;

      if (profile.role === "admin") {
        if (topBarTitle) topBarTitle.textContent = "Admin";
        if (topBarSub) topBarSub.textContent = session.user.email || "";
        await loadAgentNameMap();
        await loadAgentsForAssignDropdown();
      } else {
        const agentName = await loadAgentName(profile.agent_id);
        if (topBarTitle) topBarTitle.textContent = `Agent — ${agentName || "Unknown clinic"}`;
        if (topBarSub) topBarSub.textContent = session.user.email || "";
        if (agentClinicName) agentClinicName.value = agentName || "Unknown clinic";
      }

      nav.renderMenuForRole(profile.role);

      // keep screens neutral until user chooses
      customerModule.resetCustomerScreen();
      agentModule.resetAgentScreen();
      labsModule.resetLabsScreen();
      resetIngredientsScreen();

    } catch (e) {
      console.error("hydrateAfterLogin error:", e);
      setAuthMsg("Error after login: " + (e?.message || "Unknown error"));
    }
  }

  // =========================================================
  // BLOCK: BIND BUTTONS (FORMULARY / ING)
  // =========================================================
  if (fxTabIngredients) fxTabIngredients.addEventListener("click", () => setActiveFormularyTab("ingredients"));
if (fxTabProducts) fxTabProducts.addEventListener("click", () => setActiveFormularyTab("products"));

  if (fxIngViewBtn) fxIngViewBtn.addEventListener("click", () => showViewIngredientsPanel());
  if (fxIngAddBtn) fxIngAddBtn.addEventListener("click", () => {
    editingIngredientId = null;
    if (fxIngPsi) fxIngPsi.value = "";
    if (fxIngInci) fxIngInci.value = "";
    if (fxIngDesc) fxIngDesc.value = "";
    showAddIngredientPanel();
  });
  if (fxIngClearBtn) fxIngClearBtn.addEventListener("click", () => resetIngredientsScreen());
  if (fxIngSearchBtn) fxIngSearchBtn.addEventListener("click", async () => { await runIngredientSearch(fxIngSearch?.value || ""); });
  if (fxIngShowAllBtn) fxIngShowAllBtn.addEventListener("click", async () => { await runIngredientSearch(""); });
  if (fxIngSearch) fxIngSearch.addEventListener("keydown", async (e) => { if (e.key === "Enter") await runIngredientSearch(fxIngSearch.value || ""); });

  // =========================================================
  // BLOCK: SAVE INGREDIENT (ADD/EDIT)
  // =========================================================
  if (fxIngSaveBtn) {
    fxIngSaveBtn.addEventListener("click", async () => {
      setFxIngMsg("");

      const psi_number = (fxIngPsi?.value || "").trim();
      const inci_name = (fxIngInci?.value || "").trim();
      const short_description = (fxIngDesc?.value || "").trim() || null;

      if (!psi_number) { setFxIngMsg("PSI number is required."); return; }
      if (!inci_name) { setFxIngMsg("INCI name is required."); return; }

      // EDIT
      if (editingIngredientId) {
        const { data, error } = await supabaseClient
          .from("ingredients")
          .update({ psi_number, inci_name, short_description })
          .eq("id", editingIngredientId)
          .select("id");

        if (error) { setFxIngMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setFxIngMsg("Update blocked (RLS) — no rows updated."); return; }

        setFxIngMsg("Saved ✅");
        editingIngredientId = null;

        if (fxIngPsi) fxIngPsi.value = "";
        if (fxIngInci) fxIngInci.value = "";
        if (fxIngDesc) fxIngDesc.value = "";

        showViewIngredientsPanel();
        return;
      }

      // ADD
      const { error } = await supabaseClient
        .from("ingredients")
        .insert([{ psi_number, inci_name, short_description }]);

      if (error) { setFxIngMsg("Insert error: " + error.message); return; }

      setFxIngMsg("Ingredient added ✅");
      if (fxIngPsi) fxIngPsi.value = "";
      if (fxIngInci) fxIngInci.value = "";
      if (fxIngDesc) fxIngDesc.value = "";

      showViewIngredientsPanel();
      await runIngredientSearch("");
    });
  }

  // =========================================================
  // BLOCK: LOGIN / LOGOUT
  // =========================================================
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      setAuthMsg("Logging in…");

      const email = (emailInput?.value || "").trim();
      const password = passwordInput?.value || "";

      if (!email || !password) { setAuthMsg("Enter email + password."); return; }

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { setAuthMsg("Login failed: " + error.message); return; }
        if (!data?.session) { setAuthMsg("Login succeeded but session missing."); return; }

        await hydrateAfterLogin(data.session);
      } catch (e) {
        console.error("Login crashed:", e);
        setAuthMsg("Login crashed: " + (e?.message || "Unknown error"));
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      setLoggedOutUI("Logged out");
    });
  }

  // =========================================================
  // BLOCK: INITIAL RESTORE + AUTH EVENTS
  // =========================================================
  (async () => {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) { setLoggedOutUI("Not logged in"); return; }
      if (data?.session) await hydrateAfterLogin(data.session);
      else setLoggedOutUI("Not logged in");
    } catch (e) {
      console.error("Initial restore crashed:", e);
      setLoggedOutUI("Not logged in");
    }
  })();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth state change:", event);
    if (event === "SIGNED_OUT") setLoggedOutUI("Logged out");
    if (event === "SIGNED_IN" && session) hydrateAfterLogin(session);
  });

});
