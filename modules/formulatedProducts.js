export function initFormulatedProductsManagement({ supabaseClient, ui, helpers }) {
  const {
    fpViewBtn, fpAddBtn, fpClearBtn, fpMsg,
    fpViewPanel, fpAddPanel,
    fpSearch, fpSearchBtn, fpShowAllBtn,
    fpList,
    fpCode, fpName, fpType, fpNotes,
    fpAddLineBtn, fpLines,
    fpSaveBtn, fpCancelEditBtn
  } = ui;

  const { show, escapeHtml, confirmExact } = helpers;

  let editingProductId = null;

  let ingredientsCache = [];   // [{id, psi_number, inci_name}]
  let productTypesCache = [];  // [{id, type_code, type_name}]
  let productsById = {};       // { [id]: product }

  const setMsg = (t) => { if (fpMsg) fpMsg.textContent = t || ""; };
    function setActivePill(which) {
    // which = "view" or "add"
    if (fpViewBtn) fpViewBtn.classList.toggle("btn-gold", which === "view");
    if (fpAddBtn) fpAddBtn.classList.toggle("btn-gold", which === "add");
  }


function resetScreen() {
  setMsg("");
  editingProductId = null;
  setActivePill("view");


    show(fpViewPanel, false);
    show(fpAddPanel, false);
    show(fpClearBtn, false);

    if (fpSearch) fpSearch.value = "";
    if (fpList) fpList.innerHTML = "";

    if (fpCode) fpCode.value = "";
    if (fpName) fpName.value = "";
    if (fpNotes) fpNotes.value = "";
    if (fpLines) fpLines.innerHTML = "";
  }

  async function loadLookups() {
    // Product Types
    {
      const { data, error } = await supabaseClient
        .from("product_types")
        .select("id, type_code, type_name")
        .order("type_code", { ascending: true });

      if (error) throw error;
      productTypesCache = data || [];
    }

    // Ingredients
    {
      const { data, error } = await supabaseClient
        .from("ingredients")
        .select("id, psi_number, inci_name")
        .order("psi_number", { ascending: true });

      if (error) throw error;
      ingredientsCache = data || [];
    }

    // Fill product type dropdown (uses UUID id)
    if (fpType) {
      fpType.innerHTML = "";
      productTypesCache.forEach(pt => {
        const opt = document.createElement("option");
        opt.value = pt.id;
        opt.textContent = `${pt.type_code} — ${pt.type_name}`;
        fpType.appendChild(opt);
      });
    }
  }

  function ingredientOptionsHTML(selectedId = "") {
    const opts = ingredientsCache.map(i => {
      const label = `${i.psi_number} — ${i.inci_name}`;
      const sel = i.id === selectedId ? "selected" : "";
      return `<option value="${escapeHtml(i.id)}" ${sel}>${escapeHtml(label)}</option>`;
    }).join("");
    return `<option value="">Select ingredient…</option>${opts}`;
  }

  function addLine(line = { ingredient_id: "", pct: "" }) {
    const row = document.createElement("div");
    row.className = "ingredient-row";
    row.style.gridTemplateColumns = "1fr 140px 120px";
    row.style.alignItems = "center";

    row.innerHTML = `
      <div class="ingredient-cell">
        <select class="fp-ingSel">${ingredientOptionsHTML(line.ingredient_id)}</select>
      </div>

      <div class="ingredient-cell">
        <input class="fp-pct" type="number" step="0.001" min="0" placeholder="%" value="${line.pct ?? ""}">
      </div>

      <div class="ingredient-actions">
        <button class="ing-link ing-delete" type="button">Remove</button>
      </div>
    `;

    row.querySelector(".ing-delete").addEventListener("click", () => row.remove());
    fpLines.appendChild(row);
  }

  function getLinesFromUI() {
    const rows = Array.from(fpLines.querySelectorAll(".ingredient-row"));
    const lines = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const ingredient_id = r.querySelector(".fp-ingSel")?.value || "";
      const pctStr = r.querySelector(".fp-pct")?.value || "";
      const pct = Number(pctStr);

      if (!ingredient_id && !pctStr) continue;

      if (!ingredient_id) return { error: "Please select an ingredient for every line." };
      if (!Number.isFinite(pct) || pct <= 0) return { error: "Each ingredient line needs a % greater than 0." };

      lines.push({ ingredient_id, pct, sort_order: idx + 1 });
    }

    // duplicate ingredient check
    const set = new Set();
    for (const l of lines) {
      if (set.has(l.ingredient_id)) return { error: "You selected the same ingredient twice. Remove the duplicate line." };
      set.add(l.ingredient_id);
    }

    if (lines.length === 0) return { error: "Add at least 1 ingredient line." };

    return { lines };
  }

   function showView() {
    setActivePill("view");
    show(fpViewPanel, true);
    show(fpAddPanel, false);

    show(fpClearBtn, true);
    setMsg("");
    loadProducts("");
  }

  async function showAdd() {
    setActivePill("add");
    show(fpViewPanel, false);
    show(fpAddPanel, true);
    show(fpClearBtn, true);
    setMsg("");

    editingProductId = null;
    if (fpCode) fpCode.value = ""; // allow manual EX0001 etc
    if (fpName) fpName.value = "";
    if (fpNotes) fpNotes.value = "";
    if (fpLines) fpLines.innerHTML = "";

    addLine();
    fpCode?.focus();
  }

  async function loadProducts(term) {
    setMsg("Loading…");
    productsById = {};
    if (fpList) fpList.innerHTML = "";

    let q = supabaseClient
      .from("formulated_products")
      .select("id, product_code, name, notes, product_type_id, created_at")
      .order("product_code", { ascending: true });

    const t = (term || "").trim();
    if (t) {
      const esc = t.replaceAll("%", "\\%").replaceAll("_", "\\_");
      q = q.or(`product_code.ilike.%${esc}%,name.ilike.%${esc}%`);
    }

    const { data, error } = await q;
    if (error) {
      setMsg("Load failed: " + error.message);
      return;
    }

    const rows = data || [];
    rows.forEach(p => { productsById[p.id] = p; });

    if (rows.length === 0) {
      setMsg("No products found.");
      return;
    }

    setMsg(`Found ${rows.length} product${rows.length === 1 ? "" : "s"}.`);

    fpList.innerHTML = rows.map(p => {
      const typeObj = productTypesCache.find(x => x.id === p.product_type_id);
      const typeLabel = typeObj ? `${typeObj.type_code} — ${typeObj.type_name}` : "Unknown type";

      return `
        <div class="customer-row" data-id="${escapeHtml(p.id)}">
          <div class="customer-main">
            <div class="name">${escapeHtml(p.product_code || "")} — ${escapeHtml(p.name || "")}</div>
            <div class="meta"><span>${escapeHtml(typeLabel)}</span></div>
          </div>

          <div class="customer-context">
            <span class="pill-soft">${escapeHtml(typeLabel)}</span>
          </div>

          <div class="customer-actions">
            <button class="btn-primary fp-edit" type="button">Edit</button>
            <button class="btn-danger fp-del" type="button">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    fpList.querySelectorAll(".fp-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".customer-row");
        const id = row?.getAttribute("data-id");
        if (id) editProduct(id);
      });
    });

    fpList.querySelectorAll(".fp-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".customer-row");
        const id = row?.getAttribute("data-id");
        if (id) deleteProduct(id);
      });
    });
  }

  async function editProduct(productId) {
    const p = productsById[productId];
    if (!p) return;
setActivePill("add");
    editingProductId = p.id;

    show(fpViewPanel, false);
    show(fpAddPanel, true);
    show(fpClearBtn, true);
    setMsg("Editing — change and Save product.");

    if (fpCode) fpCode.value = p.product_code || "";
    if (fpName) fpName.value = p.name || "";
    if (fpNotes) fpNotes.value = p.notes || "";
    if (fpType) fpType.value = p.product_type_id || "";
    if (fpLines) fpLines.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("formulated_product_ingredients")
      .select("ingredient_id, pct, sort_order")
      .eq("product_id", p.id)
      .order("sort_order", { ascending: true });

    if (error) {
      setMsg("Could not load ingredients: " + error.message);
      return;
    }

    const lines = data || [];
    if (lines.length === 0) addLine();
    else lines.forEach(l => addLine({ ingredient_id: l.ingredient_id, pct: l.pct }));

    fpCode?.focus();
  }

  async function deleteProduct(productId) {
    const p = productsById[productId];
    const label = p ? `${p.product_code} — ${p.name}` : "this product";

    const ok = await confirmExact(`Delete "${label}"? This cannot be undone.`);
    if (!ok) return;

    const { data, error } = await supabaseClient
      .from("formulated_products")
      .delete()
      .eq("id", productId)
      .select("id");

    if (error) { setMsg("Delete failed: " + error.message); return; }
    if (!data || data.length === 0) { setMsg("Delete blocked (RLS) — no rows deleted."); return; }

    setMsg("Deleted ✅");
    await loadProducts(fpSearch?.value || "");
  }

  async function saveProduct() {
    setMsg("");

    const product_code = (fpCode?.value || "").trim().toUpperCase();
    const product_name = (fpName?.value || "").trim();
    const product_type_id = fpType?.value || "";
    const notes = (fpNotes?.value || "").trim() || null;

    if (!product_code) return setMsg("Enter Product code.");
    if (!product_name) return setMsg("Enter Product name.");
    if (!product_type_id) return setMsg("Select Product type.");

    const { lines, error: linesErr } = getLinesFromUI();
    if (linesErr) return setMsg(linesErr);

    let productId = editingProductId;

    if (productId) {
      const { data, error } = await supabaseClient
        .from("formulated_products")
        .update({ product_code, name: product_name, product_type_id, notes })
        .eq("id", productId)
        .select("id");

      if (error) return setMsg("Save failed: " + error.message);
      if (!data || data.length === 0) return setMsg("Save blocked (RLS).");
    } else {
      const { data, error } = await supabaseClient
        .from("formulated_products")
        .insert([{ product_code, name: product_name, product_type_id, notes }])
        .select("id")
        .single();

      if (error) return setMsg("Save failed: " + error.message);
      productId = data.id;
    }

    // Replace ingredient lines
    {
      const { error: delErr } = await supabaseClient
        .from("formulated_product_ingredients")
        .delete()
        .eq("product_id", productId);

      if (delErr) return setMsg("Could not update ingredients: " + delErr.message);

      const payload = lines.map(l => ({
        product_id: productId,
        ingredient_id: l.ingredient_id,
        pct: l.pct,
        sort_order: l.sort_order
      }));

      const { error: insErr } = await supabaseClient
        .from("formulated_product_ingredients")
        .insert(payload);

      if (insErr) return setMsg("Could not save ingredients: " + insErr.message);
    }

    setMsg("Saved ✅");
    editingProductId = null;
    showView();
  }

  function bindOnce() {
    if (fpViewBtn && fpViewBtn.dataset.bound !== "1") {
      fpViewBtn.addEventListener("click", showView);
      fpViewBtn.dataset.bound = "1";
    }

    if (fpAddBtn && fpAddBtn.dataset.bound !== "1") {
      fpAddBtn.addEventListener("click", showAdd);
      fpAddBtn.dataset.bound = "1";
    }

    if (fpClearBtn && fpClearBtn.dataset.bound !== "1") {
      fpClearBtn.addEventListener("click", resetScreen);
      fpClearBtn.dataset.bound = "1";
    }

    if (fpAddLineBtn && fpAddLineBtn.dataset.bound !== "1") {
      fpAddLineBtn.addEventListener("click", () => addLine());
      fpAddLineBtn.dataset.bound = "1";
    }

    if (fpSaveBtn && fpSaveBtn.dataset.bound !== "1") {
      fpSaveBtn.addEventListener("click", saveProduct);
      fpSaveBtn.dataset.bound = "1";
    }

    if (fpCancelEditBtn && fpCancelEditBtn.dataset.bound !== "1") {
      fpCancelEditBtn.addEventListener("click", showView);
      fpCancelEditBtn.dataset.bound = "1";
    }

    if (fpSearchBtn && fpSearchBtn.dataset.bound !== "1") {
      fpSearchBtn.addEventListener("click", () => loadProducts(fpSearch?.value || ""));
      fpSearchBtn.dataset.bound = "1";
    }

    if (fpShowAllBtn && fpShowAllBtn.dataset.bound !== "1") {
      fpShowAllBtn.addEventListener("click", () => loadProducts(""));
      fpShowAllBtn.dataset.bound = "1";
    }

    if (fpSearch && fpSearch.dataset.bound !== "1") {
      fpSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") loadProducts(fpSearch.value || "");
      });
      fpSearch.dataset.bound = "1";
    }
  }

  bindOnce();

  return {
    resetFormulatedProductsScreen: resetScreen,
    enter: async () => {
      resetScreen();
      await loadLookups();
      showView();
    }
  };
}
