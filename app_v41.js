import { showWelcomePanel } from "./modules/welcome.js";
import { initNavigation } from "./modules/navigation.js";
import { initCustomerManagement } from "./modules/customers.js";
import { initAgentManagement } from "./modules/agents.js";
import { initLabManagement } from "./modules/labs.js";
import { initProductTypesManagement } from "./modules/productTypes.js";
import { initFormulatedProductsManagement } from "./modules/formulatedProducts.js";
import { initAccountManagersManagement } from "./modules/accountManagers.js";
import { initUserManagement } from "./modules/userManagement.js";
import { initProductsAdmin } from "./modules/productsAdmin.js";
import { initOrdersManagement } from "./modules/orders.js";



console.log("EXACT Agents Portal loaded (v42)");

// =========================================================
// BLOCK: SUPABASE CLIENT
// =========================================================
const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";
const STRIPE_PUBLISHABLE_KEY = "pk_test_51SrZvuH7nI5LR99YsjnLy2FKDx0Fcl8KAQMyWkK8LGHlg6IB1Ex97sqKJfvTOBxCw1snPG65A2WLEE2WdrlxaFS600sU5ZDKty";
window.STRIPE_PUBLISHABLE_KEY = STRIPE_PUBLISHABLE_KEY; // optional (handy for console)

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
// =========================================================
// DEVTOOLS / EDGE FUNCTION TEST HOOKS
// (Do NOT create a new Supabase client in console. Use this one.)
// =========================================================
window.supabaseClient = supabaseClient;
window.sb = supabaseClient; // optional short alias

window.exactGeneratePack = async (orderId) => {
  // 1) ensure we have a valid session JWT
  const { data: { session }, error: sessErr } = await window.supabaseClient.auth.getSession();
  if (sessErr) throw sessErr;
  if (!session?.access_token) throw new Error("No active session (JWT missing). Log in first, then retry.");

  // 2) invoke Edge Function using the SAME authenticated client
  const { data, error } = await window.supabaseClient.functions.invoke(
    "exact_trio_v1_generate_pack",
    { body: { order_id: orderId } }
  );

  if (error) throw error;
  return data;
};

window.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // BLOCK: HELPERS
  // =========================================================
function show(el, on) {
  if (!el) return;
  el.style.display = on ? "" : "none";
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
    const existing = document.getElementById("exactConfirmOverlay");
    if (existing) existing.remove();

    const dlg = document.getElementById("confirmDialog");
    try {
      if (dlg && dlg.open && typeof dlg.close === "function") dlg.close();
    } catch (_e) { }

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
        try { overlay.remove(); } catch (_e) { }
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
  // BLOCK: CHANGE PASSWORD (TOOL + SUBTLE LINK)
  // =========================================================
  function renderChangePasswordTool(containerEl) {
    if (!containerEl) return;

    const existing = document.getElementById("pwTool");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "pwTool";
    wrap.className = "card";
    wrap.style.marginTop = "12px";

    wrap.innerHTML = `
      <h3 style="margin-top:0;">Change Password</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <label class="subtle" style="display:block; margin-bottom:6px;">New password</label>
          <input id="pwNew" type="password" value="" autocomplete="new-password" placeholder="New password (min 8 chars)" />
        </div>
        <div style="flex:1; min-width:220px;">
          <label class="subtle" style="display:block; margin-bottom:6px;">Confirm new password</label>
          <input id="pwConfirm" type="password" value="" autocomplete="new-password" placeholder="Repeat new password" />
        </div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
        <button id="pwSaveBtn" class="btn-primary" type="button">Update password</button>
        <span id="pwMsg" class="subtle"></span>
      </div>
    `;

    containerEl.appendChild(wrap);

    const pwNew = document.getElementById("pwNew");
    const pwConfirm = document.getElementById("pwConfirm");
    const pwSaveBtn = document.getElementById("pwSaveBtn");
    const pwMsg = document.getElementById("pwMsg");

    if (pwNew) pwNew.value = "";
    if (pwConfirm) pwConfirm.value = "";

    const setPwMsg = (t) => { if (pwMsg) pwMsg.textContent = t || ""; };

    pwSaveBtn?.addEventListener("click", async () => {
      const a = String(pwNew?.value || "").trim();
      const b = String(pwConfirm?.value || "").trim();

      if (!a || a.length < 8) { setPwMsg("Password must be at least 8 characters."); return; }
      if (a !== b) { setPwMsg("Passwords do not match."); return; }

      setPwMsg("Updating…");

      const { error } = await supabaseClient.auth.updateUser({ password: a });
      if (error) { setPwMsg("Update failed: " + error.message); return; }

      if (pwNew) pwNew.value = "";
      if (pwConfirm) pwConfirm.value = "";
      setPwMsg("Password updated ✅");
    });
  }

  function renderChangePasswordLink(containerEl) {
    if (!containerEl) return;

    if (document.getElementById("pwLinkWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "pwLinkWrap";
    wrap.style.marginTop = "6px";
    wrap.style.fontSize = "13px";
    wrap.style.color = "var(--muted)";

    wrap.innerHTML = `
      <span>
        Click <a href="#" id="pwOpenLink" style="text-decoration:underline;">here</a>
        if you would like to change your password.
      </span>
    `;

    containerEl.appendChild(wrap);

    const link = document.getElementById("pwOpenLink");
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      renderChangePasswordTool(containerEl);
      wrap.remove();
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

  // Forgot password UI (now SAFE: DOM exists)
  const forgotPwLink = document.getElementById("forgotPwLink");
  const forgotPwPanel = document.getElementById("forgotPwPanel");
  const forgotPwEmail = document.getElementById("forgotPwEmail");
  const forgotPwSendBtn = document.getElementById("forgotPwSendBtn");
  const forgotPwMsg = document.getElementById("forgotPwMsg");
  const setForgotMsg = (t) => { if (forgotPwMsg) forgotPwMsg.textContent = t || ""; };

  forgotPwLink?.addEventListener("click", (e) => {
    e.preventDefault();
    setForgotMsg("");
    if (forgotPwPanel) forgotPwPanel.style.display = (forgotPwPanel.style.display === "none" ? "block" : "none");
    if (forgotPwEmail) forgotPwEmail.value = "";
  });

  forgotPwSendBtn?.addEventListener("click", async () => {
    const email = String(forgotPwEmail?.value || "").trim().toLowerCase();
    if (!email) { setForgotMsg("Please enter your email."); return; }

    setForgotMsg("Sending…");

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
     redirectTo: "https://seltsikp.github.io/exact-portal/"

    });

    if (error) { setForgotMsg("Failed: " + error.message); return; }
    setForgotMsg("Reset email sent. Check your inbox.");
  });

  // Views
  const viewWelcome = document.getElementById("viewWelcome");
  const welcomeContent = document.getElementById("welcomeContent");
  const viewCustomerMgmt = document.getElementById("viewCustomerMgmt");
  const viewAgentMgmt = document.getElementById("viewAgentMgmt");
  const viewFormulary = document.getElementById("viewFormulary");
  const viewLabMgmt = document.getElementById("viewLabMgmt");
  const viewAccountManagers = document.getElementById("viewAccountManagers");
  const viewProductTypes = document.getElementById("viewProductTypes");
  const viewUserMgmt = document.getElementById("viewUserMgmt");

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
const agentEmailInput = document.getElementById("agentEmail");
const agentPhoneInput = document.getElementById("agentPhone");
const agentShipAddressInput = document.getElementById("agentShipAddress");
const agentShipCityInput = document.getElementById("agentShipCity");
const agentShipCountryInput = document.getElementById("agentShipCountry");


  const agentNameInput = document.getElementById("agentName");
  const addAgentBtn = document.getElementById("addAgentBtn");

  // Add customer fields
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const custDobInput = document.getElementById("custDob");
  const custGenderInput = document.getElementById("custGender");
  const custEmailInput = document.getElementById("custEmail");
  const custPhoneInput = document.getElementById("custPhone");
  const addCustomerBtn = document.getElementById("addCustomerBtn");
  const custShipAddressInput = document.getElementById("custShipAddress");
  const custShipCityInput = document.getElementById("custShipCity");
  const custShipCountryInput = document.getElementById("custShipCountry");


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

    // Products view + UI
 
  const viewProductsAdmin = document.getElementById("viewProductsAdmin");

const paViewBtn = document.getElementById("paViewBtn");
const paClearBtn = document.getElementById("paClearBtn");
const paMsg = document.getElementById("paMsg");
const paListPanel = document.getElementById("paListPanel");
const paList = document.getElementById("paList");

const paEditPanel = document.getElementById("paEditPanel");
const paProductName = document.getElementById("paProductName");
const paEdgeFn = document.getElementById("paEdgeFn");
const paSubject = document.getElementById("paSubject");
const paBody = document.getElementById("paBody");
const paSendEmail = document.getElementById("paSendEmail");
const paIncludeLinks = document.getElementById("paIncludeLinks");
const paIncludeAttachments = document.getElementById("paIncludeAttachments");
const paSaveBtn = document.getElementById("paSaveBtn");
const paCancelBtn = document.getElementById("paCancelBtn");

const paKind = document.getElementById("paKind");
const paCurrency = document.getElementById("paCurrency");
const paUnitPrice = document.getElementById("paUnitPrice");
const paIsActive = document.getElementById("paIsActive");
const paDynamicBlock = document.getElementById("paDynamicBlock");
const paStaticNote = document.getElementById("paStaticNote");


  // Product Types view + UI
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

// ==============================
// USER MANAGEMENT UI
// ==============================
const umSaveBtn = document.getElementById("umSaveBtn");
const umCancelBtn = document.getElementById("umCancelBtn");

const umAddBtn = document.getElementById("umAddBtn");
const umSearch = document.getElementById("umSearch");
const umSearchBtn = document.getElementById("umSearchBtn");
const umShowAllBtn = document.getElementById("umShowAllBtn");

// ==============================
// ORDERS UI
// ==============================
const viewOrders = document.getElementById("viewOrders");

const ordersMsg = document.getElementById("ordersMsg");
const ordersListPanel = document.getElementById("ordersListPanel");
const ordersSearch = document.getElementById("ordersSearch");
const ordersSearchBtn = document.getElementById("ordersSearchBtn");
const ordersShowAllBtn = document.getElementById("ordersShowAllBtn");
const ordersStatusFilter = document.getElementById("ordersStatusFilter");
const ordersList = document.getElementById("ordersList");
const ordersCreateBtn = document.getElementById("ordersCreateBtn");


const ordersDetailPanel = document.getElementById("ordersDetailPanel");
const ordersDetailTitle = document.getElementById("ordersDetailTitle");
const ordersDetailMeta = document.getElementById("ordersDetailMeta");
const ordersBackBtn = document.getElementById("ordersBackBtn");
const ordersRefreshBtn = document.getElementById("ordersRefreshBtn");
const ordersGeneratePackBtn = document.getElementById("ordersGeneratePackBtn");

const ordersBatchSummary = document.getElementById("ordersBatchSummary");
const ordersArtifactsList = document.getElementById("ordersArtifactsList");

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
      custDobInput,
      custGenderInput,
      custEmailInput,
      custPhoneInput,
      custShipAddressInput,
      custShipCityInput,
      custShipCountryInput,

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
      agentEmailInput,
      agentPhoneInput,
      agentShipAddressInput,
      agentShipCityInput,
      agentShipCountryInput,

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

  const productsAdminModule = initProductsAdmin({
  supabaseClient,
  ui: {
    paViewBtn, paClearBtn, paMsg,
    paListPanel, paList,
    paEditPanel,
    paProductName, paEdgeFn, paSubject, paBody,
    paSendEmail, paIncludeLinks, paIncludeAttachments,
    paSaveBtn, paCancelBtn
  },
  helpers: { show, escapeHtml, confirmExact }
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

const ordersModule = initOrdersManagement({
  supabaseClient,
  ui: {
    viewOrders,

    ordersMsg,
    ordersListPanel,
    ordersSearch,
    ordersSearchBtn,
    ordersShowAllBtn,
    ordersStatusFilter,
    ordersList,
    ordersCreateBtn,


    ordersDetailPanel,
    ordersDetailTitle,
    ordersDetailMeta,
    ordersBackBtn,
    ordersRefreshBtn,
    ordersGeneratePackBtn,

    ordersBatchSummary,
    ordersArtifactsList,
  },
  helpers: {
    show,
    escapeHtml,
    formatDateShort,
    confirmExact,
  },
  state: {
    // IMPORTANT: currentProfile changes after login,
    // so give the module a getter instead of a fixed snapshot
    get currentProfile() { return currentProfile; },
    get stripePublishableKey() { return STRIPE_PUBLISHABLE_KEY; }
  }
});


  const userMgmtModule = initUserManagement({
    supabaseClient,
    ui: {
      umViewBtn, umAddBtn, umClearBtn, umMsg,
      umViewPanel, umEditPanel, umList,
      umSearch, umSearchBtn, umShowAllBtn,
      umFullName, umEmail, umPassword, umRole, umStatus,
      umPerms, umSaveBtn, umCancelBtn
    },
    helpers: { show, escapeHtml, confirmExact },
    state: {
      get currentProfile() { return currentProfile; }
    }
  });

  // =========================================================
  // BLOCK: RESET INGREDIENTS SCREEN
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
// BLOCK: INGREDIENTS MANAGEMENT (VIEW/ADD/EDIT/DELETE)
// =========================================================
function setActiveIngPill(which) {
  // which = "view" or "add"
  fxIngViewBtn?.classList.toggle("btn-gold", which === "view");
  fxIngViewBtn?.classList.toggle("btn-primary", which !== "view");

  fxIngAddBtn?.classList.toggle("btn-gold", which === "add");
  fxIngAddBtn?.classList.toggle("btn-primary", which !== "add");
}

function showIngView() {
  setActiveIngPill("view");
  show(fxIngViewPanel, true);
  show(fxIngAddPanel, false);
  show(fxIngClearBtn, true);
  setFxIngMsg("");
  loadIngredients("");
}

function showIngAdd() {
  setActiveIngPill("add");
  show(fxIngViewPanel, false);
  show(fxIngAddPanel, true);
  show(fxIngClearBtn, true);
  setFxIngMsg("");

  editingIngredientId = null;

  if (fxIngPsiNum) fxIngPsiNum.value = "";
  if (fxIngInci) fxIngInci.value = "";
  if (fxIngDesc) fxIngDesc.value = "";

  fxIngPsiNum?.focus();
}

async function loadIngredients(term) {
  if (!fxIngList) { setFxIngMsg("Ingredients list container missing (fxIngList)."); return; }

  setFxIngMsg("Loading…");
  ingredientsById = {};
  fxIngList.innerHTML = "";

  let q = supabaseClient
    .from("ingredients")
    .select("id, psi_number, inci_name, short_description, created_at")
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
  if (error) { setFxIngMsg("Load failed: " + error.message); return; }

  const rows = data || [];
  rows.forEach(r => { ingredientsById[r.id] = r; });

  if (rows.length === 0) {
    setFxIngMsg("No ingredients found.");
    return;
  }

  setFxIngMsg(`Found ${rows.length} ingredient${rows.length === 1 ? "" : "s"}.`);

  fxIngList.innerHTML = rows.map(r => {
    const id = escapeHtml(r.id);
    const psi = escapeHtml(r.psi_number || "");
    const inci = escapeHtml(r.inci_name || "");
    const desc = escapeHtml(r.short_description || "");

    return `
      <div class="customer-row" data-id="${id}">
        <div>${psi}</div>
        <div>${inci}</div>
        <div class="subtle">${desc}</div>
        <div class="customer-actions">
          <button class="btn-primary fxIng-edit" type="button">Edit</button>
          <button class="btn-danger fxIng-del" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }).join("");

  // Edit buttons
  fxIngList.querySelectorAll(".fxIng-edit").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".customer-row");
      const id = row?.getAttribute("data-id");
      if (id) editIngredient(id);
    });
  });

  // Delete buttons
  fxIngList.querySelectorAll(".fxIng-del").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".customer-row");
      const id = row?.getAttribute("data-id");
      if (id) deleteIngredient(id);
    });
  });
}

function editIngredient(id) {
  const r = ingredientsById[id];
  if (!r) return;

  setActiveIngPill("add");
  editingIngredientId = id;

  show(fxIngViewPanel, false);
  show(fxIngAddPanel, true);
  show(fxIngClearBtn, true);

  setFxIngMsg("Editing — change and Save ingredient.");

  if (fxIngPsiNum) fxIngPsiNum.value = r.psi_number || "";
  if (fxIngInci) fxIngInci.value = r.inci_name || "";
  if (fxIngDesc) fxIngDesc.value = r.short_description || "";

  fxIngInci?.focus();
}

async function deleteIngredient(id) {
  const r = ingredientsById[id];
  const label = r ? `${r.psi_number || ""} — ${r.inci_name || ""}` : "this ingredient";

  const ok = await confirmExact(`Delete "${label}"? This cannot be undone.`);
  if (!ok) return;

  const { data, error } = await supabaseClient
    .from("ingredients")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) { setFxIngMsg("Delete failed: " + error.message); return; }
  if (!data || data.length === 0) { setFxIngMsg("Delete blocked (RLS) — no rows deleted."); return; }

  setFxIngMsg("Deleted ✅");
  await loadIngredients(fxIngSearch?.value || "");
}

async function saveIngredient() {
  setFxIngMsg("");

  const psi_number = String(fxIngPsiNum?.value || "").trim();
  const inci_name = String(fxIngInci?.value || "").trim();
  const short_description = String(fxIngDesc?.value || "").trim() || null;

  if (!psi_number) return setFxIngMsg("PSI number is required.");
  if (!inci_name) return setFxIngMsg("INCI name is required.");

  if (editingIngredientId) {
    const { data, error } = await supabaseClient
      .from("ingredients")
  .update({ psi_number, inci_name, short_description })

      .eq("id", editingIngredientId)
      .select("id");

    if (error) return setFxIngMsg("Save failed: " + error.message);
    if (!data || data.length === 0) return setFxIngMsg("Save blocked (RLS).");
  } else {
    const { error } = await supabaseClient
      .from("ingredients")
      .insert([{ psi_number, inci_name, short_description }]);


    if (error) return setFxIngMsg("Save failed: " + error.message);
  }

  setFxIngMsg("Saved ✅");
  editingIngredientId = null;
  showIngView();
}

function bindIngredientsOnce() {
  if (fxIngViewBtn && fxIngViewBtn.dataset.bound !== "1") {
    fxIngViewBtn.addEventListener("click", showIngView);
    fxIngViewBtn.dataset.bound = "1";
  }

  if (fxIngAddBtn && fxIngAddBtn.dataset.bound !== "1") {
    fxIngAddBtn.addEventListener("click", showIngAdd);
    fxIngAddBtn.dataset.bound = "1";
  }

  if (fxIngClearBtn && fxIngClearBtn.dataset.bound !== "1") {
    fxIngClearBtn.addEventListener("click", resetIngredientsScreen);
    fxIngClearBtn.dataset.bound = "1";
  }

  if (fxIngSaveBtn && fxIngSaveBtn.dataset.bound !== "1") {
    fxIngSaveBtn.addEventListener("click", saveIngredient);
    fxIngSaveBtn.dataset.bound = "1";
  }

  if (fxIngSearchBtn && fxIngSearchBtn.dataset.bound !== "1") {
    fxIngSearchBtn.addEventListener("click", () => loadIngredients(fxIngSearch?.value || ""));
    fxIngSearchBtn.dataset.bound = "1";
  }

  if (fxIngShowAllBtn && fxIngShowAllBtn.dataset.bound !== "1") {
    fxIngShowAllBtn.addEventListener("click", () => loadIngredients(""));
    fxIngShowAllBtn.dataset.bound = "1";
  }

  if (fxIngSearch && fxIngSearch.dataset.bound !== "1") {
    fxIngSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadIngredients(fxIngSearch.value || "");
    });
    fxIngSearch.dataset.bound = "1";
  }
}

// Bind Ingredients buttons now
bindIngredientsOnce();

  // =========================================================
  // BLOCK: AUTH + PROFILE LOOKUPS
  // =========================================================
  async function loadProfileForUser(userId) {
    const res = await supabaseClient
      .from("agent_users")
      .select("agent_id, role, status, email, full_name, permissions")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { data, error } = res;

    if (error) {
      console.error("agent_users lookup error:", error);
      throw error;
    }

    if (!data) return null;
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
// Wire Formulary tabs (Ingredients / Products)
if (fxTabIngredients && fxTabIngredients.dataset.bound !== "1") {
  fxTabIngredients.addEventListener("click", () => {
    setActiveFormularyTab("ingredients");
    resetIngredientsScreen();
  });
  fxTabIngredients.dataset.bound = "1";
}

if (fxTabProducts && fxTabProducts.dataset.bound !== "1") {
  fxTabProducts.addEventListener("click", async () => {
    setActiveFormularyTab("products");
    await formulatedProductsModule.enter();
  });
  fxTabProducts.dataset.bound = "1";
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
      formulary: viewFormulary,
      productsAdmin: viewProductsAdmin,
      orders: viewOrders,
      userMgmt: viewUserMgmt
    },
    show,

    canAccess: (viewKey) => {
      if (viewKey === "welcome") return true;
      if (!currentProfile) return false;

      const role = String(currentProfile.role || "").trim().toLowerCase();


      // userMgmt is ADMIN only, always
      if (viewKey === "userMgmt") return role === "admin";

      // admins can access everything
      if (role === "admin") return true;

      // otherwise respect permissions json
      const p = currentProfile.permissions || {};
      return !!p[viewKey];
    },

    onEnter: {
      welcome: () => {
        showWelcomePanel({ containerEl: welcomeContent });

        // Non-admin: show subtle change-password link
        const role = String(currentProfile.role || "").trim().toLowerCase();

        if (role !== "admin") {
          renderChangePasswordLink(welcomeContent);
        }
      },

      customers: () => customerModule.resetCustomerScreen(),
      agents: () => agentModule.resetAgentScreen(),
      accountManagers: () => accountManagersModule.resetAccountManagersScreen(),
      productsAdmin: () => productsAdminModule.reset(),
      productTypes: async () => {
        productTypesModule.resetProductTypesScreen();
        await productTypesModule.loadProductTypes();
      },
      labs: () => labsModule.resetLabsScreen(),
      orders: async () => { await ordersModule.enter(); },
      userMgmt: () => userMgmtModule.resetUserScreen(),
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
        console.error("loadProfileForUser failed:", e?.message || e, e);
      }

      if (!profile) {
        await supabaseClient.auth.signOut();
        setLoggedOutUI("Access not provisioned");
        setAuthMsg("Login blocked: your account is not provisioned. Please contact admin.");
        return;
      }

      if ((profile.status || "").toLowerCase() !== "active") {
        await supabaseClient.auth.signOut();
        setLoggedOutUI("Account inactive");
        setAuthMsg("Your account is inactive. Please contact admin.");
        return;
      }

      currentProfile = profile;

      if ((profile.role || "").toLowerCase() === "admin") {
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

      nav.renderMenuForRole(profile.role, profile.permissions || {});

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

    if (event === "SIGNED_OUT") {
      setLoggedOutUI("Logged out");
      return;
    }

    // Password recovery: after user clicks the email link
    if (event === "PASSWORD_RECOVERY" && session) {
      hydrateAfterLogin(session).then(() => {
        try {
          // Ensure Welcome is visible and open Change Password card
          show(viewWelcome, true);
          renderChangePasswordTool(welcomeContent);
        } catch (_e) { }
      });
      return;
    }

    if (event === "SIGNED_IN" && session) {
      hydrateAfterLogin(session);
      return;
    }
  });

});
