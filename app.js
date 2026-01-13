console.log("EXACT Agents Portal loaded (v36)");

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

  function validateCustomerFieldsLive() {
    if (!cmAddPanel || cmAddPanel.style.display === "none") return;

    const first = (firstNameInput?.value || "").trim();
    const last  = (lastNameInput?.value || "").trim();
    const email = (custEmailInput?.value || "").trim();
    const phone = (custPhoneInput?.value || "").trim();

    if (!first) markField(firstNameInput, "error"); else markField(firstNameInput, "ok");
    if (!last) markField(lastNameInput, "error"); else markField(lastNameInput, "ok");

    if (!email) markField(custEmailInput, null);
    else if (!isValidEmail(email)) markField(custEmailInput, "error");
    else markField(custEmailInput, "ok");

    if (!phone) markField(custPhoneInput, null);
    else if (!isValidPhone(phone)) markField(custPhoneInput, "error");
    else markField(custPhoneInput, "ok");
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

  // ✅ Views (IMPORTANT: include Welcome)
  const viewWelcome = document.getElementById("viewWelcome");
  const viewCustomerMgmt = document.getElementById("viewCustomerMgmt");
  const viewAgentMgmt = document.getElementById("viewAgentMgmt");
  const viewFormulary = document.getElementById("viewFormulary");

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
  const fxTabBases = document.getElementById("fxTabBases");
  const fxTabBoosters = document.getElementById("fxTabBoosters");

  const fxSectionIngredients = document.getElementById("fxSectionIngredients");
  const fxSectionBases = document.getElementById("fxSectionBases");
  const fxSectionBoosters = document.getElementById("fxSectionBoosters");

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

  // =========================================================
  // BLOCK: STATE
  // =========================================================
  let currentSession = null;
  let currentProfile = null;
  let hydratedUserId = null;

  let activeViewKey = null;

  let agentNameMap = {};
  let customersById = {};
  let agentsById = {};

  let editingCustomerId = null;
  let editingAgentId = null;

  let ingredientsById = {};
  let editingIngredientId = null;

  const setAgentMsg = (t) => { if (agentMsg) agentMsg.textContent = t || ""; };
  const setAuthMsg = (t) => { if (authMsg) authMsg.textContent = t || ""; };
  const setCustMsg = (t) => { if (custMsg) custMsg.textContent = t || ""; };
  const setFxIngMsg = (t) => { if (fxIngMsg) fxIngMsg.textContent = t || ""; };

  // =========================================================
  // BLOCK: ROW RENDERERS
  // =========================================================
  function buildCustomerRowHTML(c, { role, agentNameMap }) {
    const id = escapeHtml(c.id);
    const code = escapeHtml(c.customer_code || "");

    const first = (c.first_name ?? "").trim();
    const last = (c.last_name ?? "").trim();
    const fullName = `${first} ${last}`.trim() || "Unnamed Customer";

    const name = escapeHtml(fullName);
    const email = escapeHtml((c.email || "").trim());
    const phone = escapeHtml((c.phone || "").trim());
    const created = formatDateShort(c.created_at);

    let metaLine = "";
    const codePart = code ? `<span>${code}</span><span class="customer-dot">•</span>` : "";

    if (email && phone) metaLine = `${codePart}<span>${email}</span><span class="customer-dot">•</span><span>${phone}</span>`;
    else if (email) metaLine = `${codePart}<span>${email}</span>`;
    else if (phone) metaLine = `${codePart}<span>${phone}</span>`;
    else metaLine = codePart || `<span style="opacity:.65;">No contact details</span>`;

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
          <button class="btn btn-soft action-pill edit-pill" data-action="edit" type="button">Edit</button>
          <button class="btn action-pill delete-pill" data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

  function buildAgentRowHTML(a) {
    const id = escapeHtml(a.id);
    const code = escapeHtml(a.agent_code || "");
    const name = escapeHtml((a.name || "").trim() || "Unnamed agent");
    const created = formatDateShort(a.created_at);
    const createdPill = created ? `<span class="pill-soft">Created: ${escapeHtml(created)}</span>` : "";

    return `
      <div class="customer-row" data-agent-id="${id}">
        <div class="customer-main">
          <div class="name">${name}</div>
          <div class="meta"><span style="opacity:.75;">${code}</span></div>
        </div>

        <div class="customer-context">
          ${createdPill}
        </div>

        <div class="customer-actions">
          <button class="btn btn-soft action-pill edit-pill" data-action="edit" type="button">Edit</button>
          <button class="btn action-pill delete-pill" data-action="delete" type="button">Delete</button>
        </div>
      </div>
    `.trim();
  }

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
  // BLOCK: SCREEN STATE HELPERS (AGENTS / CUSTOMERS / INGREDIENTS)
  // =========================================================
  function resetAgentScreen() {
    show(amViewPanel, false);
    show(amAddPanel, false);
    show(amClearBtn, false);

    if (agentList) agentList.innerHTML = "";
    agentsById = {};
    editingAgentId = null;

    if (agentNameInput) agentNameInput.value = "";
    setAgentMsg("");
  }

  function showViewAgentsPanel() {
    show(amViewPanel, true);
    show(amAddPanel, false);
    show(amClearBtn, true);

    if (amSearch) amSearch.focus();
    setAgentMsg("Enter a search term or click “Show all”.");
  }

  function showAddAgentPanel() {
    show(amViewPanel, false);
    show(amAddPanel, true);
    show(amClearBtn, true);

    setAgentMsg("");
    if (agentNameInput) agentNameInput.focus();
  }

  function resetCustomerScreen() {
    show(cmViewPanel, false);
    show(cmAddPanel, false);
    show(cmClearBtn, false);

    if (customerList) customerList.innerHTML = "";
    customersById = {};
    editingCustomerId = null;

    clearAddForm();
    setCustMsg("");
  }

  function showViewCustomersPanel() {
    show(cmViewPanel, true);
    show(cmAddPanel, false);
    show(cmClearBtn, true);

    if (cmSearch) cmSearch.focus();
    setCustMsg("Enter a search term or click “Show all”.");
  }

  function showAddCustomerPanel() {
    show(cmViewPanel, false);
    show(cmAddPanel, true);
    show(cmClearBtn, true);

    setCustMsg("");

    if (currentProfile?.role === "admin") {
      show(assignClinicRow, true);
      show(agentClinicRow, false);
    } else {
      show(assignClinicRow, false);
      show(agentClinicRow, true);
    }

    validateCustomerFieldsLive();
    if (firstNameInput) firstNameInput.focus();
  }

  function clearAddForm() {
    if (firstNameInput) firstNameInput.value = "";
    if (lastNameInput) lastNameInput.value = "";
    if (custEmailInput) custEmailInput.value = "";
    if (custPhoneInput) custPhoneInput.value = "";
    editingCustomerId = null;
    clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);
  }

  function resetIngredientsScreen() {
    show(fxIngViewPanel, false);
    show(fxIngAddPanel, false);
    show(fxIngClearBtn, false);

    if (fxIngList) fxIngList.innerHTML = "";
    if (fxIngList) fxIngList.className = "ingredient-list";

    ingredientsById = {};
    editingIngredientId = null;

    if (fxIngPsi) fxIngPsi.value = "";
    if (fxIngInci) fxIngInci.value = "";
    if (fxIngDesc) fxIngDesc.value = "";

    setFxIngMsg("");
  }

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
  // BLOCK: LIST DELEGATIONS (AGENTS / CUSTOMERS)
  // =========================================================
  function ensureAgentListDelegation() {
    if (!agentList) return;
    if (agentList.dataset.bound === "1") return;

    agentList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const row = e.target.closest(".customer-row");
      if (!row) return;

      const agentId = row.getAttribute("data-agent-id");
      const action = btn.getAttribute("data-action");
      const a = agentsById[agentId];
      if (!a) return;

      if (action === "edit") {
        editingAgentId = a.id;
        if (agentNameInput) agentNameInput.value = a.name || "";
        showAddAgentPanel();
        setAgentMsg("Editing agent — click Save agent to update.");
        return;
      }

      if (action === "delete") {
        setAgentMsg("");

        const agentName = (a.name || "").trim() || "this agent";
        const ok = await confirmExact(`Delete ${agentName}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("agents")
          .delete()
          .eq("id", a.id)
          .select("id");

        if (error) { setAgentMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setAgentMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setAgentMsg("Deleted ✅");

        await loadAgentNameMap();
        await loadAgentsForAssignDropdown();
        await runAgentSearch(amSearch?.value || "");
      }
    });

    agentList.dataset.bound = "1";
  }

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
        editingCustomerId = c.id;
        if (firstNameInput) firstNameInput.value = c.first_name || "";
        if (lastNameInput) lastNameInput.value = c.last_name || "";
        if (custEmailInput) custEmailInput.value = c.email || "";
        if (custPhoneInput) custPhoneInput.value = c.phone || "";

        showAddCustomerPanel();
        setCustMsg("Editing customer — click Save customer to update.");
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

        if (error) { setCustMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setCustMsg("Delete blocked (RLS) — no rows deleted."); return; }

        setCustMsg("Deleted ✅");
        await runCustomerSearch(cmSearch?.value || "");
      }
    });

    customerList.dataset.bound = "1";
  }

  // =========================================================
  // BLOCK: QUERIES (AGENTS / CUSTOMERS / INGREDIENTS)
  // =========================================================
  async function runAgentSearch(term) {
    if (!agentList) return;

    ensureAgentListDelegation();

    agentList.innerHTML = "";
    agentsById = {};
    setAgentMsg("Searching…");

    let q = supabaseClient
      .from("agents")
      .select("id, agent_code, name, created_at")
      .order("created_at", { ascending: false });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.ilike("name", `%${esc}%`);
    }

    const { data, error } = await q;

    if (error) {
      setAgentMsg("Search error: " + error.message);
      return;
    }

    const rows = data || [];
    rows.forEach(a => { agentsById[a.id] = a; });

    agentList.innerHTML = rows.map(buildAgentRowHTML).join("");

    if (rows.length === 0) setAgentMsg("No matches found.");
    else setAgentMsg(`Found ${rows.length} agent${rows.length === 1 ? "" : "s"}.`);
  }

  async function runCustomerSearch(term) {
    if (!customerList) return;

    ensureCustomerListDelegation();

    customerList.innerHTML = "";
    customersById = {};
    setCustMsg("Searching…");

    const role = currentProfile?.role || "agent";

    let q = supabaseClient
      .from("customers")
      .select("id, customer_code, agent_id, first_name, last_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.or([
        `first_name.ilike.%${esc}%`,
        `last_name.ilike.%${esc}%`,
        `email.ilike.%${esc}%`,
        `phone.ilike.%${esc}%`
      ].join(","));
    }

    const { data, error } = await q;

    if (error) { setCustMsg("Search error: " + error.message); return; }

    const rows = data || [];
    rows.forEach(c => { customersById[c.id] = c; });

    customerList.innerHTML = rows
      .map(c => buildCustomerRowHTML(c, { role, agentNameMap }))
      .join("");

    if (rows.length === 0) setCustMsg("No matches found.");
    else setCustMsg(`Found ${rows.length} customer${rows.length === 1 ? "" : "s"}.`);
  }

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
    fxTabBases?.classList.toggle("active", tabKey === "bases");
    fxTabBoosters?.classList.toggle("active", tabKey === "boosters");

    show(fxSectionIngredients, tabKey === "ingredients");
    show(fxSectionBases, tabKey === "bases");
    show(fxSectionBoosters, tabKey === "boosters");
  }

  // =========================================================
  // BLOCK: VIEWS + MENU  ✅ FIXED WELCOME SUPPORT
  // =========================================================
  function setActiveView(viewKey) {
    activeViewKey = viewKey;

    // permissions
    if (viewKey === "agents" && currentProfile?.role !== "admin") return;
    if (viewKey === "formulary" && currentProfile?.role !== "admin") return;

    // ✅ show/hide views
    show(viewWelcome, viewKey === "welcome");
    show(viewCustomerMgmt, viewKey === "customers");
    show(viewAgentMgmt, viewKey === "agents");
    show(viewFormulary, viewKey === "formulary");

    // ✅ menu highlight
    if (menuItems) {
      const btns = menuItems.querySelectorAll("button[data-view]");
      btns.forEach(b => b.classList.toggle("active", b.getAttribute("data-view") === viewKey));
    }

    // reset screens only when entering those views
    if (viewKey === "customers") resetCustomerScreen();
    if (viewKey === "agents") resetAgentScreen();

    if (viewKey === "formulary") {
      setActiveFormularyTab("ingredients");
      resetIngredientsScreen();
    }
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

    // ✅ Always show Welcome first
    addMenuBtn("Welcome", "welcome");

    if (role === "admin") {
      addMenuBtn("Agent Management", "agents");
      addMenuBtn("Customer Management", "customers");
      addMenuBtn("EXACT Formulary", "formulary");
    } else {
      addMenuBtn("Customer Management", "customers");
    }

    // ✅ Default view after login
    setActiveView("welcome");
  }

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
    editingAgentId = null;
    editingCustomerId = null;
    editingIngredientId = null;
    activeViewKey = null;

    resetCustomerScreen();
    resetAgentScreen();
    resetIngredientsScreen();

    // ensure welcome not shown while logged out
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
        renderMenuForRole("agent");
        setActiveView("welcome");
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

      renderMenuForRole(profile.role);

      // keep screens neutral until user chooses
      resetCustomerScreen();
      resetAgentScreen();
      resetIngredientsScreen();

    } catch (e) {
      console.error("hydrateAfterLogin error:", e);
      setAuthMsg("Error after login: " + (e?.message || "Unknown error"));
    }
  }

  // =========================================================
  // BLOCK: BIND BUTTONS (CUSTOMERS / AGENTS / FORMULARY / ING)
  // =========================================================
  if (cmViewBtn) cmViewBtn.addEventListener("click", () => showViewCustomersPanel());
  if (cmAddBtn) cmAddBtn.addEventListener("click", () => { clearAddForm(); showAddCustomerPanel(); });
  if (cmClearBtn) cmClearBtn.addEventListener("click", () => resetCustomerScreen());
  if (cmSearchBtn) cmSearchBtn.addEventListener("click", async () => { await runCustomerSearch(cmSearch?.value || ""); });
  if (cmShowAllBtn) cmShowAllBtn.addEventListener("click", async () => { await runCustomerSearch(""); });
  if (cmSearch) cmSearch.addEventListener("keydown", async (e) => { if (e.key === "Enter") await runCustomerSearch(cmSearch.value || ""); });

  if (amViewBtn) amViewBtn.addEventListener("click", () => showViewAgentsPanel());
  if (amAddBtn) amAddBtn.addEventListener("click", () => { editingAgentId = null; if (agentNameInput) agentNameInput.value = ""; showAddAgentPanel(); });
  if (amClearBtn) amClearBtn.addEventListener("click", () => resetAgentScreen());
  if (amSearchBtn) amSearchBtn.addEventListener("click", async () => { await runAgentSearch(amSearch?.value || ""); });
  if (amShowAllBtn) amShowAllBtn.addEventListener("click", async () => { await runAgentSearch(""); });
  if (amSearch) amSearch.addEventListener("keydown", async (e) => { if (e.key === "Enter") await runAgentSearch(amSearch.value || ""); });

  if (fxTabIngredients) fxTabIngredients.addEventListener("click", () => setActiveFormularyTab("ingredients"));
  if (fxTabBases) fxTabBases.addEventListener("click", () => setActiveFormularyTab("bases"));
  if (fxTabBoosters) fxTabBoosters.addEventListener("click", () => setActiveFormularyTab("boosters"));

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
  // BLOCK: SAVE CUSTOMER (ADD/EDIT)
  // =========================================================
  [firstNameInput, lastNameInput, custEmailInput, custPhoneInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", validateCustomerFieldsLive);
    el.addEventListener("blur", validateCustomerFieldsLive);
  });

  if (addCustomerBtn) {
    addCustomerBtn.addEventListener("click", async () => {
      setCustMsg("");

      const first_name = (firstNameInput?.value || "").trim();
      const last_name = (lastNameInput?.value || "").trim();
      const email = (custEmailInput?.value || "").trim() || null;
      const phone = (custPhoneInput?.value || "").trim() || null;

      clearFieldMarks(firstNameInput, lastNameInput, custEmailInput, custPhoneInput);

      if (!first_name) { markField(firstNameInput, "error"); setCustMsg("First name is required."); return; }
      markField(firstNameInput, "ok");

      if (!last_name) { markField(lastNameInput, "error"); setCustMsg("Last name is required."); return; }
      markField(lastNameInput, "ok");

      if (email && !isValidEmail(email)) { markField(custEmailInput, "error"); setCustMsg("Please enter a valid email address."); return; }
      if (email) markField(custEmailInput, "ok");

      if (phone && !isValidPhone(phone)) { markField(custPhoneInput, "error"); setCustMsg("Please enter a valid phone number."); return; }
      if (phone) markField(custPhoneInput, "ok");

      let agent_id = null;

      if (currentProfile?.role === "admin") {
        agent_id = assignClinicSelect?.value || null;
        if (!agent_id) { setCustMsg("Please select a clinic to assign this customer to."); return; }
      } else {
        agent_id = currentProfile?.agent_id || null;
        if (!agent_id) { setCustMsg("No clinic linked to this login."); return; }
      }

      if (editingCustomerId) {
        const { data, error } = await supabaseClient
          .from("customers")
          .update({ first_name, last_name, email, phone })
          .eq("id", editingCustomerId)
          .select("id");

        if (error) { setCustMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setCustMsg("Update blocked (RLS) — no rows updated."); return; }

        setCustMsg("Saved ✅");
        clearAddForm();
        showViewCustomersPanel();
        await runCustomerSearch(cmSearch?.value || "");
        return;
      }

      const { error } = await supabaseClient
        .from("customers")
        .insert([{ agent_id, first_name, last_name, email, phone }]);

      if (error) { setCustMsg("Insert error: " + error.message); return; }

      setCustMsg("Customer added ✅");
      clearAddForm();
      showViewCustomersPanel();
    });
  }

  // =========================================================
  // BLOCK: SAVE AGENT (ADD/EDIT)
  // =========================================================
  if (addAgentBtn) {
    addAgentBtn.addEventListener("click", async () => {
      setAgentMsg("");

      const name = (agentNameInput?.value || "").trim();
      if (!name) { setAgentMsg("Agent name is required."); return; }

      if (editingAgentId) {
        const { data, error } = await supabaseClient
          .from("agents")
          .update({ name })
          .eq("id", editingAgentId)
          .select("id");

        if (error) { setAgentMsg("Update error: " + error.message); return; }
        if (!data || data.length === 0) { setAgentMsg("Update blocked (RLS) — no rows updated."); return; }

        setAgentMsg("Saved ✅");
        editingAgentId = null;
        if (agentNameInput) agentNameInput.value = "";

        await loadAgentNameMap();
        await loadAgentsForAssignDropdown();

        showViewAgentsPanel();
        await runAgentSearch(amSearch?.value || "");
        return;
      }

      const { error } = await supabaseClient
        .from("agents")
        .insert([{ name }]);

      if (error) { setAgentMsg("Insert error: " + error.message); return; }

      setAgentMsg("Agent added ✅");
      if (agentNameInput) agentNameInput.value = "";

      await loadAgentNameMap();
      await loadAgentsForAssignDropdown();

      showViewAgentsPanel();
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
