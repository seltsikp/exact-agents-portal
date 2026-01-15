import { showWelcomePanel } from "./modules/welcome.js";
import { initNavigation } from "./modules/navigation.js";
import { initCustomerManagement } from "./modules/customers.js";
import { initAgentManagement } from "./modules/agents.js";
import { initLabManagement } from "./modules/labs.js";
import { initProductTypesManagement } from "./modules/productTypes.js";
import { initFormulatedProductsManagement } from "./modules/formulatedProducts.js";
import { initAccountManagersManagement } from "./modules/accountManagers.js";




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
  // =========================================================
// BLOCK: CONFIRM DIALOG
// =========================================================
async function confirmExact(message) {
  // Hard stop: never use <dialog> modal state (it can leave an invisible backdrop).
  // We use a custom overlay that always removes itself.
  const existing = document.getElementById("exactConfirmOverlay");
  if (existing) existing.remove();

  // If a native dialog exists and is open from a previous run, force-close it.
  const dlg = document.getElementById("confirmDialog");
  try {
    if (dlg && dlg.open && typeof dlg.close === "function") dlg.close();
  } catch (e) {}

  return await new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "exactConfirmOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "999999";
    overlay.style.pointerEvents = "auto";

    const modal = document.createElement("div");
    modal.style.width = "min(520px, calc(100vw - 32px))";
    modal.style.background = "#fff";
    modal.style.border = "1px solid rgba(0,0,0,0.12)";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)";
    modal.style.padding = "16px";

    const txt = document.createElement("div");
    txt.textContent = String(message || "Are you sure?");
    txt.style.margin = "0 0 14px 0";
    txt.style.whiteSpace = "pre-wrap";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.justifyContent = "flex-end";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn-primary";
    btnCancel.type = "button";
    btnCancel.textContent = "Cancel";

    const btnOk = document.createElement("button");
    btnOk.className = "btn-danger";
    btnOk.type = "button";
    btnOk.textContent = "Confirm";

    let done = false;
    const cleanup = (val) => {
      if (done) return;
      done = true;
      try { overlay.remove(); } catch (e) {}
      window.removeEventListener("keydown", onKey);
      resolve(val);
    };

    const onKey = (e) => {
      if (e.key === "Escape") cleanup(false);
      if (e.key === "Enter") cleanup(true);
    };

    btnCancel.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    });

    btnOk.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(true);
    });

    // Click outside = cancel
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
    });

    window.addEventListener("keydown", onKey);

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);

    modal.appendChild(txt);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(() => btnOk.focus(), 0);
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

  const fxIngPsiNum = document.getElementById("fxIngPsiNum");
  const fxIngInci = document.getElementById("fxIngInci");
  const fxIngDesc = document.getElementById("fxIngDesc");
  const fxIngSaveBtn = document.getElementById("fxIngSaveBtn");

  // Product Types view + UI
  const viewProductTypes = document.getElementById("viewProductTypes");
  const ptName = document.getElementById("pt_name");
  const ptAddBtn = document.getElementById("pt_addBtn");
  const ptTbody = document.getElementById("pt_tbody");
  const ptStatus = document.getElementById("pt_status");

  // Formulated Products UI
const fpViewBtn = document.getElementById("fpViewBtn");
const fpAddBtn = document.getElementById("fpAddBtn");
const fpClearBtn = document.getElementById("fpClearBtn");
const fpMsg = document.getElementById("fpMsg");

const fpViewPanel = document.getElementById("fpViewPanel");
const fpAddPanel = document.getElementById("fpAddPanel");

const fpSearch = document.getElementById("fpSearch");
const fpSearchBtn = document.getElementById("fpSearchBtn");
const fpShowAllBtn = document.getElementById("fpShowAllBtn");
const fpList = document.getElementById("fpList");

const fpCode = document.getElementById("fpCode");
const fpName = document.getElementById("fpName");
const fpType = document.getElementById("fpType");
const fpNotes = document.getElementById("fpNotes");

const fpAddLineBtn = document.getElementById("fpAddLineBtn");
const fpLines = document.getElementById("fpLines");

const fpSaveBtn = document.getElementById("fpSaveBtn");
const fpCancelEditBtn = document.getElementById("fpCancelEditBtn");

   // Account Managers UI
const amgrViewBtn = document.getElementById("amgrViewBtn");
const amgrAddBtn = document.getElementById("amgrAddBtn");
const amgrClearBtn = document.getElementById("amgrClearBtn");
const amgrMsg = document.getElementById("amgrMsg");
const amgrViewPanel = document.getElementById("amgrViewPanel");
const amgrAddPanel = document.getElementById("amgrAddPanel");
const amgrList = document.getElementById("amgrList");

const amgrFirstName = document.getElementById("amgrFirstName");
const amgrLastName = document.getElementById("amgrLastName");
const amgrEmail = document.getElementById("amgrEmail");
const amgrPhone = document.getElementById("amgrPhone");
const amgrAddress = document.getElementById("amgrAddress");
const amgrNotes = document.getElementById("amgrNotes");
const amgrSaveBtn = document.getElementById("amgrSaveBtn");

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
  ui: { ptName, ptAddBtn, ptTbody, ptStatus },
  helpers: { confirmExact }
});

const formulatedProductsModule = initFormulatedProductsManagement({
  supabaseClient,
  ui: {
    fpViewBtn, fpAddBtn, fpClearBtn, fpMsg,
    fpViewPanel, fpAddPanel,
    fpSearch, fpSearchBtn, fpShowAllBtn,
    fpList,
    fpCode, fpName, fpType, fpNotes,
    fpAddLineBtn, fpLines,
    fpSaveBtn, fpCancelEditBtn
  },
  helpers: { show, escapeHtml, confirmExact }
});

  const accountManagersModule = initAccountManagersManagement({
  supabaseClient,
  ui: {
    amgrViewBtn,
    amgrAddBtn,
    amgrClearBtn,
    amgrMsg,
    amgrViewPanel,
    amgrAddPanel,
    amgrList,
    amgrFirstName,
    amgrLastName,
    amgrEmail,
    amgrPhone,
    amgrAddress,
    amgrNotes,
    amgrSaveBtn
  },
  helpers: { show, confirmExact }
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
if (fxIngPsiNum) fxIngPsiNum.value = "";
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
if (fxIngPsiNum) {
  // Expecting PSI-001 etc
  const m = String(i.psi_number || "").match(/(\d+)/);
  fxIngPsiNum.value = m ? Number(m[1]) : "";
}
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
if (fxIngPsiNum) fxIngPsiNum.focus();
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
      accountManagers: viewAccountManagers,
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
      if (viewKey === "accountManagers" && currentProfile?.role !== "admin") return false;

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
  accountManagers: () => {
    accountManagersModule.resetAccountManagersScreen();
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
productTypesModule.resetProductTypesScreen();
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
productTypesModule.resetProductTypesScreen();
resetIngredientsScreen();


    } catch (e) {
      console.error("hydrateAfterLogin error:", e);
      setAuthMsg("Error after login: " + (e?.message || "Unknown error"));
    }
  }

  // =========================================================
  // BLOCK: BIND BUTTONS (FORMULARY / ING)
  // =========================================================
if (fxTabIngredients) fxTabIngredients.addEventListener("click", () => {
  setActiveFormularyTab("ingredients");
});

if (fxTabProducts) fxTabProducts.addEventListener("click", async () => {
  setActiveFormularyTab("products");
  await formulatedProductsModule.enter();
});


  if (fxIngViewBtn) fxIngViewBtn.addEventListener("click", () => showViewIngredientsPanel());
  if (fxIngAddBtn) fxIngAddBtn.addEventListener("click", () => {
    editingIngredientId = null;
if (fxIngPsiNum) fxIngPsiNum.value = "";
    if (fxIngInci) fxIngInci.value = "";
    if (fxIngDesc) fxIngDesc.value = "";
    showAddIngredientPanel();
  });
  if (fxIngClearBtn) fxIngClearBtn.addEventListener("click", () => resetIngredientsScreen());
  if (fxIngSearchBtn) fxIngSearchBtn.addEventListener("click", async () => { await runIngredientSearch(fxIngSearch?.value || ""); });
  if (fxIngShowAllBtn) fxIngShowAllBtn.addEventListener("click", async () => { await runIngredientSearch(""); });
  if (fxIngSearch) fxIngSearch.addEventListener("keydown", async (e) => { if (e.key === "Enter") await runIngredientSearch(fxIngSearch.value || ""); });

  function formatPsiNumber(numStr) {
  const n = Number(String(numStr || "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  return "PSI-" + String(n).padStart(3, "0");
}

async function psiNumberExists(psi_number, excludeId = null) {
  if (!psi_number) return false;

  let q = supabaseClient
    .from("ingredients")
    .select("id")
    .eq("psi_number", psi_number)
    .limit(1);

  if (excludeId) q = q.neq("id", excludeId);

  const { data, error } = await q;
  if (error) {
    // If RLS prevents reading, you STILL should enforce uniqueness at DB level (see note below)
    console.warn("psiNumberExists check failed:", error.message);
    return false;
  }

  return (data || []).length > 0;
}

 // =========================================================
// BLOCK: SAVE INGREDIENT (ADD/EDIT)
// =========================================================
if (fxIngSaveBtn) {
  fxIngSaveBtn.addEventListener("click", async () => {
    setFxIngMsg("");

    const psi_number = formatPsiNumber(fxIngPsiNum?.value);
    const inci_name = (fxIngInci?.value || "").trim();
    const short_description = (fxIngDesc?.value || "").trim() || null;

    if (!psi_number) { setFxIngMsg("Enter a PSI number between 1 and 999."); return; }
    if (!inci_name) { setFxIngMsg("INCI name is required."); return; }

    const exists = await psiNumberExists(psi_number, editingIngredientId);
    if (exists) {
      setFxIngMsg(`Duplicate PSI number: ${psi_number} already exists.`);
      return;
    }

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

      if (fxIngPsiNum) fxIngPsiNum.value = "";
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
    if (fxIngPsiNum) fxIngPsiNum.value = "";
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
