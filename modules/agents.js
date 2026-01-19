// modules/agents.js
export function initAgentManagement({
  supabaseClient,
  ui,
  helpers,
  state
}) {
  const {
    show,
    escapeHtml,
    formatDateShort,
    confirmExact
  } = helpers;

    const {
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
  } = ui;

  let agentsById = {};
  let editingAgentId = null;

  const setAgentMsg = (t) => { if (agentMsg) agentMsg.textContent = t || ""; };

  // -------------------------
  // screen helpers
  // -------------------------
  function resetAgentScreen() {
    show(amViewPanel, false);
    show(amAddPanel, false);
    show(amClearBtn, false);

    if (agentList) agentList.innerHTML = "";
    agentsById = {};
    editingAgentId = null;

    if (agentNameInput) agentNameInput.value = "";
    if (agentEmailInput) agentEmailInput.value = "";
    if (agentPhoneInput) agentPhoneInput.value = "";
    if (agentShipAddressInput) agentShipAddressInput.value = "";
    if (agentShipCityInput) agentShipCityInput.value = "";
    if (agentShipCountryInput) agentShipCountryInput.value = "";

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

  // -------------------------
  // row renderer
  // -------------------------
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

  // -------------------------
  // list click handling
  // -------------------------
  function ensureAgentListClick() {
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
        if (agentEmailInput) agentEmailInput.value = a.email || "";
        if (agentPhoneInput) agentPhoneInput.value = a.phone || "";
        if (agentShipAddressInput) agentShipAddressInput.value = a.shipping_address || "";
        if (agentShipCityInput) agentShipCityInput.value = a.shipping_city || "";
        if (agentShipCountryInput) agentShipCountryInput.value = a.shipping_country || "";

        showAddAgentPanel();
        setAgentMsg("Editing agent — click Save agent to update.");
        return;
      }

      if (action === "delete") {
        const name = (a.name || "").trim() || "this agent";
        const ok = await confirmExact(`Delete ${name}? This cannot be undone.`);
        if (!ok) return;

        const { data, error } = await supabaseClient
          .from("agents")
          .delete()
          .eq("id", a.id)
          .select("id");

        if (error) { setAgentMsg("Delete error: " + error.message); return; }
        if (!data || data.length === 0) { setAgentMsg("Delete blocked (RLS)."); return; }

        setAgentMsg("Deleted ✅");
        await state.refreshAgents();
        await runAgentSearch(amSearch?.value || "");
      }
    });

    agentList.dataset.bound = "1";
  }

  // -------------------------
  // queries
  // -------------------------
  async function runAgentSearch(term) {
    if (!agentList) return;

    ensureAgentListClick();

    agentList.innerHTML = "";
    agentsById = {};
    setAgentMsg("Searching…");

    let q = supabaseClient
      .from("agents")
      .select("id, agent_code, name, email, phone, shipping_address, shipping_city, shipping_country, created_at")
      .order("created_at", { ascending: false });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.ilike("name", `%${esc}%`);
    }

    const { data, error } = await q;
    if (error) { setAgentMsg("Search error: " + error.message); return; }

    const rows = data || [];
    rows.forEach(a => { agentsById[a.id] = a; });
    agentList.innerHTML = rows.map(buildAgentRowHTML).join("");

    if (rows.length === 0) setAgentMsg("No matches found.");
    else setAgentMsg(`Found ${rows.length} agent${rows.length === 1 ? "" : "s"}.`);
  }

  // -------------------------
  // buttons
  // -------------------------
  if (amViewBtn) amViewBtn.addEventListener("click", showViewAgentsPanel);
  if (amAddBtn) amAddBtn.addEventListener("click", () => {
    editingAgentId = null;
    if (agentNameInput) agentNameInput.value = "";
    showAddAgentPanel();
  });
  if (amClearBtn) amClearBtn.addEventListener("click", resetAgentScreen);
  if (amSearchBtn) amSearchBtn.addEventListener("click", () => runAgentSearch(amSearch?.value || ""));
  if (amShowAllBtn) amShowAllBtn.addEventListener("click", () => runAgentSearch(""));
  if (amSearch) amSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runAgentSearch(amSearch.value || "");
  });

  // -------------------------
  // save agent
  // -------------------------
    if (addAgentBtn) {
    addAgentBtn.addEventListener("click", async () => {

      setAgentMsg("");

      const name = (agentNameInput?.value || "").trim();
      const email = (agentEmailInput?.value || "").trim() || null;
      const phone = (agentPhoneInput?.value || "").trim() || null;
      const shipping_address = (agentShipAddressInput?.value || "").trim() || null;
      const shipping_city = (agentShipCityInput?.value || "").trim() || null;
      const shipping_country = (agentShipCountryInput?.value || "").trim() || null;

      if (!name) { setAgentMsg("Agent name is required."); return; }

      if (editingAgentId) {
        const { error } = await supabaseClient
          .from("agents")
          .update({ name, email, phone, shipping_address, shipping_city, shipping_country })

          .eq("id", editingAgentId);

        if (error) { setAgentMsg("Update error: " + error.message); return; }

        setAgentMsg("Saved ✅");
        editingAgentId = null;
        if (agentNameInput) agentNameInput.value = "";
      if (agentEmailInput) agentEmailInput.value = "";
      if (agentPhoneInput) agentPhoneInput.value = "";
      if (agentShipAddressInput) agentShipAddressInput.value = "";
      if (agentShipCityInput) agentShipCityInput.value = "";
      if (agentShipCountryInput) agentShipCountryInput.value = "";

        await state.refreshAgents();
        showViewAgentsPanel();
        runAgentSearch(amSearch?.value || "");
        return;
      }

      const { error } = await supabaseClient
        .from("agents")
        .insert([{ name, email, phone, shipping_address, shipping_city, shipping_country }]);


      if (error) { setAgentMsg("Insert error: " + error.message); return; }

      setAgentMsg("Agent added ✅");
      if (agentNameInput) agentNameInput.value = "";

      await state.refreshAgents();
      showViewAgentsPanel();
    });
  }

  return {
    resetAgentScreen
  };
}
