export function initProductTypesManagement({ supabaseClient, ui, helpers }) {
  const { ptCode, ptName, ptAddBtn, ptTbody, ptStatus } = ui;
  const { confirmExact } = helpers;

  function setStatus(msg) {
    if (ptStatus) ptStatus.textContent = msg || "";
  }

  async function loadProductTypes() {
    if (!ptTbody) return;
    setStatus("Loading...");
    ptTbody.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("product_types")
      .select("id, type_code, type_name")
      .order("type_code", { ascending: true });

    if (error) {
      console.error(error);
      setStatus("Load failed: " + error.message);
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      setStatus("No product types found.");
      return;
    }

    setStatus("");

    for (const r of rows) {
      const tr = document.createElement("tr");

      const tdCode = document.createElement("td");
      tdCode.textContent = r.type_code;

      const tdName = document.createElement("td");
      tdName.textContent = r.type_name;

      const tdActions = document.createElement("td");
      tdActions.style.textAlign = "right";

      const delBtn = document.createElement("button");
      delBtn.className = "dangerBtn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        const ok = await confirmExact(`Delete "${r.type_name}"?`);
        if (!ok) return;

        const { data: delData, error: delErr } = await supabaseClient
          .from("product_types")
          .delete()
          .eq("id", r.id)
          .select("id");

        if (delErr) {
          console.error(delErr);
          alert("Delete failed: " + delErr.message);
          return;
        }
        if (!delData || delData.length === 0) {
          alert("Delete blocked (RLS) — no rows deleted.");
          return;
        }

        await loadProductTypes();
      });

      tdActions.appendChild(delBtn);

      tr.appendChild(tdCode);
      tr.appendChild(tdName);
      tr.appendChild(tdActions);

      ptTbody.appendChild(tr);
    }
  }

  function resetProductTypesScreen() {
    setStatus("");
    if (ptCode) ptCode.value = "";
    if (ptName) ptName.value = "";
    if (ptTbody) ptTbody.innerHTML = "";
  }

  async function addProductType() {
    const type_code = (ptCode?.value || "").trim().toUpperCase();
    const type_name = (ptName?.value || "").trim();

    if (!type_code || !type_name) {
      alert("Enter Type Code and Type Name.");
      return;
    }

    const { error } = await supabaseClient
      .from("product_types")
      .insert([{ type_code, type_name }]);

    if (error) {
      console.error(error);
      alert("Add failed: " + error.message);
      return;
    }

    if (ptCode) ptCode.value = "";
    if (ptName) ptName.value = "";

    await loadProductTypes();
  }

  function bind() {
    if (ptAddBtn && ptAddBtn.dataset.bound !== "1") {
      ptAddBtn.addEventListener("click", addProductType);
      ptAddBtn.dataset.bound = "1";
    }
  }

  // Bind once
  bind();

  return {
    resetProductTypesScreen,
    loadProductTypes
  };
}
