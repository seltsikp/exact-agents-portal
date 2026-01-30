// modules/orders.js
export function initOrdersManagement({ supabaseClient, ui, helpers, state }) {
  const { show, escapeHtml, formatDateShort } = helpers;

  const {
    // view containers
    viewOrders,
    ordersCreateBtn,

    // list UI
    ordersMsg,
    ordersListPanel,
    ordersSearch,
    ordersSearchBtn,
    ordersShowAllBtn,
    ordersStatusFilter,
    ordersList,

    // detail UI
    ordersDetailPanel,
    ordersDetailTitle,
    ordersDetailMeta,
    ordersBackBtn,
    ordersRefreshBtn,
    ordersGeneratePackBtn,

    // outputs
    ordersBatchSummary,
    ordersArtifactsList,
  } = ui;

  // ===== Tooltip helper (hover + tap) =====
  // ===== Tooltip helper (hover + tap) =====
// Ensure tooltip container + minimal styles exist (so tooltips work even if index.html is outdated/cached)
(function ensureExactTooltips(){
  if (!document.getElementById("exactTooltipStyle")) {
    const st = document.createElement("style");
    st.id = "exactTooltipStyle";
    st.textContent = `
  .tip-trigger{
    cursor: pointer;
    text-decoration: underline dotted rgba(0,0,0,0.25);
    text-underline-offset: 3px;
  }
  .tip-pop{
    position: fixed;
    z-index: 9999;
    max-width: min(420px, calc(100vw - 20px));
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(15,20,30,0.96);
    color: #fff;
    font-size: 13px;
    line-height: 1.35;
    box-shadow: 0 12px 28px rgba(0,0,0,0.25);
    pointer-events: none;
    display: none;
  }
  .tip-pop .tip-title{
    font-weight: 800;
    margin-bottom: 6px;
  }
`;

    document.head.appendChild(st);
  }
  if (!document.getElementById("tipPop")) {
    const d = document.createElement("div");
    d.id = "tipPop";
    d.className = "tip-pop";
    d.setAttribute("role","tooltip");
    d.setAttribute("aria-hidden","true");
    document.body.appendChild(d);
  }
})();


// --- Tooltip helpers (hover + tap) ---
function ensureTipPopExists(){
  let el = document.getElementById("tipPop");
  if (!el) {
    // Create if missing (safe fallback)
    el = document.createElement("div");
    el.id = "tipPop";
    el.className = "tip-pop";
    el.setAttribute("role", "tooltip");
    el.setAttribute("aria-hidden", "true");
    (document.body || document.documentElement).appendChild(el);
  }
  // If tipPop exists but is inside a hidden container, move it to <body> so fixed positioning works.
  if (el && document.body && el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
  return el;
}

function tipHide() {
  const el = ensureTipPopExists();
  el.style.display = "none";
  el.style.visibility = "hidden";
  el.setAttribute("aria-hidden", "true");
}

function tipShow(targetEl, title, text) {
  const el = ensureTipPopExists();
  if (!targetEl) return;

  // Hard-set baseline styles so popup is visible even if CSS is missing/overridden
  el.style.position = "fixed";
  el.style.zIndex = "99999";
  el.style.maxWidth = "min(420px, calc(100vw - 20px))";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "12px";
  el.style.background = "rgba(15, 20, 30, 0.96)";
  el.style.color = "#fff";
  el.style.fontSize = "13px";
  el.style.lineHeight = "1.35";
  el.style.boxShadow = "0 12px 28px rgba(0,0,0,0.25)";
  el.style.pointerEvents = "none";

  el.innerHTML = `
    <div class="tip-title">${escapeHtml(title || "")}</div>
    <div>${escapeHtml(text || "")}</div>
  `;

  const r = targetEl.getBoundingClientRect();
const pad = 10;

el.style.display = "block";
el.style.visibility = "visible";
el.setAttribute("aria-hidden", "false");

// Preferred position (below the label)
let left = r.left;
let top = r.bottom + 8;

// First paint at preferred coords so we can measure real size
el.style.left = Math.round(left) + "px";
el.style.top = Math.round(top) + "px";

// Measure + clamp to viewport (fixes mobile overflow/off-screen)
const pr = el.getBoundingClientRect();
const vw = window.innerWidth;
const vh = window.innerHeight;

// Clamp horizontally
if (pr.left < pad) left += (pad - pr.left);
if (pr.right > vw - pad) left -= (pr.right - (vw - pad));

// Clamp vertically: if it overflows bottom, place above label
if (pr.bottom > vh - pad) {
  top = r.top - pr.height - 8;
}
// If still too high, clamp to top padding
if (top < pad) top = pad;

el.style.left = Math.round(left) + "px";
el.style.top = Math.round(top) + "px";

}

// close tooltip on outside click/tap
document.addEventListener("pointerdown", (e) => {
  const el = document.getElementById("tipPop");
  if (!el) return;
  if (el.contains(e.target)) return;
  if (e.target && e.target.closest && e.target.closest(".tip-trigger")) return;
  tipHide();
});

window.addEventListener("scroll", tipHide, { passive: true });
window.addEventListener("resize", tipHide);



  // Admin-only buttons live in index.html (not in ui map)
  const ordersMarkPaidBtn = document.getElementById("ordersMarkPaidBtn");
  const ordersCompBtn = document.getElementById("ordersCompBtn");
  const ordersRefundBtn = document.getElementById("ordersRefundBtn");


  // Payment (Stripe) UI lives in index.html (not in ui map)
  const ordersPayPanel = document.getElementById("ordersPayPanel");
  const ordersPayMsg = document.getElementById("ordersPayMsg");
  const ordersPayBtn = document.getElementById("ordersPayBtn");
  const ordersPayCancelBtn = document.getElementById("ordersPayCancelBtn");
  const stripePaymentEl = document.getElementById("stripePaymentEl");

  // Clinician-driven manual scores UI (lives in index.html)
  const ordersClinicianPanel = document.getElementById("ordersClinicianPanel");
  const ordersScoresList = document.getElementById("ordersScoresList");
  const ordersScoresMsg = document.getElementById("ordersScoresMsg");
  const ordersScoresSaveBtn = document.getElementById("ordersScoresSaveBtn");
  const ordersScoresResetBtn = document.getElementById("ordersScoresResetBtn");

  let selectedOrderId = null;
  let lastPaymentStatus = null; // cached for clinician pay gating
  let lastPayAmountMsg = "";

  // ---------------------------------------------------------
  // Clinician scores (manual override) — 9 PS-288 dimensions
  // ---------------------------------------------------------
  const CLINICIAN_NAME_HINT = "clinician"; // used to detect the clinician-driven product by name/workflow
  const DIMENSION_KEYS = [
    "hydration",
    "acne",
    "lines",
    "pigmentation",
    "eye_area_condition",
    "redness",
    "pores",
    "translucency",
    "uniformness",
  ];

const DIM_TIPS = {
  hydration:
    "The hydration parameter reflects how skin suffers from a lack of water. Problems with hydration can be identified through indirect skin features, such as fine lines or cracks, irritation, flaking, scaling, or peeling. The higher parameter values are associated with better hydration levels.",

  acne:
    "Acne is a disorder of the skin that has many variances in its appearance between genders. The pathogenesis of acne is multifactorial and it involves four main pathways: excess sebum production, comedogenesis, Propionibacterium acnes and complex inflammatory mechanisms involving both innate and acquired immunity. Acne areas are detected and the ratio of skin area covered by detected acne is calculated. Also for each acne spot the local irritation is estimated. The higher the value of this parameter, the fewer acne spots and pimples you have",

  lines:
    "Lines, also known as wrinkles, appear as a sign of the aging process. As we age and are exposed to adverse environmental factors, the collagen and hyaluronic acid content of our skin decreases, causing the loss of moisture and elasticity. These changes lead to the development of wrinkles and sagging, or downward shifts of the skin causing nasolabial folds, marionette folds, and jowls. Over time, our lines become more prominent, developing from fine lines into deep lines. The higher the value of this parameter, the less prominent lines you have.",

  pigmentation:
    "Pigmentation refers to the coloring of the skin and is determined mainly by the brown pigment melanin. Pigmentation takes into account the prominence of dark spots, moles and freckles. Hyperpigmentation is usually harmless but can sometimes be caused by an underlying medical condition. In case of very low parameter values, it is recommended to consult a specialist. The higher the value of this parameter, the fewer pigmented spots you have.",

  eye_area_condition:
    "Eye bags are formed because of the loss of skin elasticity of lower eyelid. Eye bags progression is associated with the aging process, but it can be a sign of lack of sleep or stagnation of blood in vessels under the skin in case of circulatory disorders. The higher value in this parameter is associated with less prominent eye bags, lacrimal grooves, and dark circles.",

  redness:
    "Our skin has a natural pink color because of our blood vessels. Increased skin redness can be associated with allergic reactions and inflammatory processes. The most common environmental factors leading to facial redness are cold air or ultraviolet radiation. A higher skin redness level is associated with a lower value for this parameter.",

  pores:
    "Skin usually has pores in different conditions. They contain tiny ostia from either pilosebaceous follicles (with sebaceous glands) or sweat glands that affect their condition. Enlarged, filamented, or black-headed pores require care. The algorithm calculates the size of each pore and the number of pores. The pores are classified into small and large pores. The ratio of skin area covered by large pores is non-linearly transformed to a score that is calculated for different facial areas and the whole face. The higher the value of this parameter, the less large pores you have.",

  translucency:
    "Translucency describes how bright, clear, and radiant your skin looks. This effect comes from the way light reflects off the surface of your skin. Several factors influence this reflection—such as skin firmness, evenness of pigmentation, oil levels, and hydration. When these elements are balanced and healthy, light spreads smoothly across the skin. This creates the appearance of naturally luminous, “translucent” skin. Higher translucency values indicate better skin radiance and clarity.",

  uniformness:
    "The uniformness metric shows how smooth and even your skin is. It takes into account eruption, age spots, freckles, and blood vessels close to the surface, along with texture-associated skin features. The higher the value of this parameter, the more uniform and smooth your skin is."
};

  let clinicianScores = null; // current in-UI values (object)
  let clinicianEnabledForOrder = false;
  let clinicianSaved = false;       // saved to DB (exists on order)
  let clinicianEditing = false;     // currently unlocked for editing
  let clinicianDirty = false;       // changes made since last save
  let clinicianPaidLocked = false;  // paid/comped => permanently locked

  const setScoresMsg = (t) => { if (ordersScoresMsg) ordersScoresMsg.textContent = t || ""; };

  function clampScore(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 50;
    return Math.max(0, Math.min(100, Math.round(x)));
  }

  function defaultScores50() {
    const o = {};
    DIMENSION_KEYS.forEach(k => { o[k] = 50; });
    return o;
  }

  function normalizeScores(input) {
    const base = defaultScores50();
    if (!input || typeof input !== "object") return base;
    DIMENSION_KEYS.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(input, k)) base[k] = clampScore(input[k]);
    });
    return base;
  }

  function isProbablyClinicianProduct(prod) {
    const name = String(prod?.name || "").toLowerCase();
    const wf = String(prod?.workflow_key || "").toLowerCase();
    return name.includes(CLINICIAN_NAME_HINT) || wf.includes(CLINICIAN_NAME_HINT);
  }

  async function loadOrderProductInfo(orderId) {
    const { data, error } = await supabaseClient
      .from("order_items")
      .select("product_id, product:products ( id, name, workflow_key )")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) return { error, product: null };
    const row = Array.isArray(data) && data.length ? data[0] : null;
    return { error: null, product: row?.product || null };
  }

  function renderClinicianScoresPanel(scoresObj) {
    if (!ordersClinicianPanel || !ordersScoresList) return;
    try {

    clinicianScores = normalizeScores(scoresObj);

    const rowHtml = (key) => {
      const val = clampScore(clinicianScores[key]);
      const label = escapeHtml(String(key || "").split("_").join(" "));
      return `
        <div class="scoreRow" data-score-key="${escapeHtml(key)}">
          <div class="scoreLabel"><span class="tip-trigger" data-tip-title="${label}" data-tip="${escapeHtml(DIM_TIPS[key] || "" )}">${label}</span></div>
          <div>
            <div class="scoreTrack">
              <input type="range" min="0" max="100" step="1" value="${val}" />
              <span class="scoreDot" style="left:${val}%;"></span>
            </div>
          </div>
        </div>
      `;
    };

    ordersScoresList.innerHTML = DIMENSION_KEYS.map(rowHtml).join("");

    
// Force the "colour track + dot" UI even if CSS didn't load (prevents grey native sliders)
// Make the native range input invisible but still interactive.
ordersScoresList.querySelectorAll('.scoreTrack input[type="range"]').forEach(inp => {
  inp.style.position = "absolute";
  inp.style.inset = "0";
  inp.style.width = "100%";
  inp.style.height = "100%";
  inp.style.opacity = "0";
  inp.style.cursor = "pointer";
  inp.style.margin = "0";
});
// Bind range -> dot position
    ordersScoresList.querySelectorAll(".scoreRow").forEach(row => {
      const key = row.getAttribute("data-score-key");
      const input = row.querySelector('input[type="range"]');
      const dot = row.querySelector(".scoreDot");
      if (!key || !input || !dot) return;

      const apply = () => {
        const v = clampScore(input.value);
        const prev = clinicianScores[key];
        clinicianScores[key] = v;
        dot.style.left = v + "%";

        // If editing, any change marks dirty and flips button to "Save scores"
        if (!clinicianPaidLocked && clinicianEditing && prev !== v) {
          clinicianDirty = true;
          updateClinicianButtons();
          enforceClinicianPaymentGate();
        }
      };

      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
      apply();
    });

    // Tooltip wiring (hover + tap)
    ordersScoresList.querySelectorAll(".tip-trigger").forEach(el => {
      const title = el.getAttribute("data-tip-title") || "";
      const text = el.getAttribute("data-tip") || "";

      el.addEventListener("mouseenter", () => tipShow(el, title, text));
      el.addEventListener("mouseleave", () => { window.setTimeout(tipHide, 80); });

      // mobile tap toggle
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pop = document.getElementById("tipPop");
        if (pop && pop.style && pop.style.display === "block" && pop.getAttribute("aria-hidden") === "false") tipHide();
        else tipShow(el, title, text);
      });
    });

    } catch (e) {
      console.error("[ClinicianScores] render failed:", e);
      ordersScoresList.innerHTML = "";
      setScoresMsg("Scores UI error: " + (e?.message || e));
    }
  }



  function setClinicianInputsLocked(locked) {
    if (!ordersScoresList) return;
    ordersScoresList.querySelectorAll('input[type="range"]').forEach(inp => {
      inp.disabled = !!locked;
    });
  }

  function updateClinicianButtons() {
    if (!ordersScoresSaveBtn) return;

    // Paid orders: permanently locked, hide controls
    if (clinicianPaidLocked) {
      ordersScoresSaveBtn.style.display = "none";
      if (ordersScoresResetBtn) ordersScoresResetBtn.style.display = "none";
      return;
    }

    // Unpaid: show controls
    ordersScoresSaveBtn.style.display = "";
    if (ordersScoresResetBtn) ordersScoresResetBtn.style.display = clinicianEditing ? "" : "none";

    if (!clinicianSaved) {
      ordersScoresSaveBtn.textContent = "Save scores";
      return;
    }

    // Saved already
    if (!clinicianEditing) {
      ordersScoresSaveBtn.textContent = "Edit scores";
    } else {
      // Editing: keep 'Edit scores' until any change occurs, then switch to 'Save scores'
      ordersScoresSaveBtn.textContent = clinicianDirty ? "Save scores" : "Edit scores";
    }
  }


  function enforceClinicianPaymentGate() {
    if (!clinicianEnabledForOrder) return;
    if (!ordersPayBtn) return;

    const ps = String(lastPaymentStatus || "").toLowerCase();
    if (ps === "paid" || ps === "comped") return;

    const okToPay = clinicianSaved && !clinicianEditing && !clinicianDirty;
    if (!okToPay) {
      ordersPayBtn.disabled = true;
      ordersPayBtn.textContent = "Pay now (save scores first)";
      ordersPayBtn.onclick = null;
      if (ordersPayMsg) ordersPayMsg.textContent = "Save clinician scores to proceed to payment.";
    } else {
      ordersPayBtn.disabled = false;
      ordersPayBtn.textContent = "Pay now";
      ordersPayBtn.onclick = () => mountStripePaymentForOrder(selectedOrderId);
      if (ordersPayMsg && lastPayAmountMsg) ordersPayMsg.textContent = lastPayAmountMsg;
    }
  }

  function setClinicianStateFromOrderRow(o) {
    const saved = extractScoresFromOrderRow(o);
    clinicianSaved = !!(saved && typeof saved === "object");
    clinicianDirty = false;
    clinicianEditing = false;
    return saved;
  }

  async function persistClinicianScoresToOrder(orderId, scores) {
    // We don't assume an exact schema: we try common column names until one succeeds.
    // This makes the UI resilient even if your SQL used a slightly different naming.
    const { data: sessData, error: sessErr } = await supabaseClient.auth.getSession();
    if (sessErr) throw new Error(sessErr.message);
    const userId = sessData?.session?.user?.id || null;

    const attempts = [
      { clinician_dimensions: scores, clinician_set_by: userId, clinician_set_at: new Date().toISOString() },
      { manual_scores: scores, manual_scores_set_by: userId },
      { manual_dimensions: scores, manual_dimensions_set_by: userId },
      { clinician_scores: scores, clinician_scores_set_by: userId },
      { scan_dimensions: scores, scan_set_by: userId, scan_source: "clinician" },
      { dimensions_override: scores, dimensions_set_by: userId, dimensions_source: "clinician" },
    ];

    let lastErr = null;
    for (const payload of attempts) {
      const { error } = await supabaseClient
        .from("orders")
        .update(payload)
        .eq("id", orderId);

      if (!error) return { ok: true, used: Object.keys(payload) };
      lastErr = error;
      // If the failure isn't "column does not exist", don't keep trying.
      if (!String(error.message || "").toLowerCase().includes("column")) break;
    }

    return { ok: false, error: lastErr };
  }

  function extractScoresFromOrderRow(o) {
    if (!o || typeof o !== "object") return null;
    const candidates = ["clinician_dimensions", "manual_scores", "manual_dimensions", "clinician_scores", "scan_dimensions", "dimensions_override"];
    for (const c of candidates) {
      const v = o[c];
      if (v && typeof v === "object") return v;
    }
    return null;
  }

  const getRole = () => String(state?.currentProfile?.role || "").toLowerCase();
  const isAdminNow = () => getRole() === "admin";
  const canGeneratePackNow = () => {
    const r = getRole();
    return r === "admin" || r === "agent";
  };

  const setMsg = (t) => { if (ordersMsg) ordersMsg.textContent = t || ""; };

  function resetScreen() {
    setMsg("");
    selectedOrderId = null;

    if (ordersList) ordersList.innerHTML = "";
    if (ordersBatchSummary) ordersBatchSummary.innerHTML = "";
    if (ordersArtifactsList) ordersArtifactsList.innerHTML = "";

    show(ordersListPanel, true);
    show(ordersDetailPanel, false);
  }

  // ---------------------------------------------------------
  // Create Order modal
  // ---------------------------------------------------------
  function renderCreateOrderModal({ products, defaultProductId, customers, agent, onSubmit, onCancel }) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "999999";

    const card = document.createElement("div");
    card.className = "card";
    card.style.width = "min(620px, calc(100vw - 32px))";

    card.innerHTML = `
      <h3 style="margin-top:0;">Create Order</h3>

      <label class="subtle">Product</label>
      <select id="coProduct" style="width:100%; margin-bottom:10px;">
        <option value="">Select product…</option>
        ${(products || []).map(p =>
          `<option value="${p.id}">${escapeHtml((p.product_code ? (p.product_code + " — ") : "") + (p.name || ""))}</option>`
        ).join("")}
      </select>

      <label class="subtle">Customer</label>
      <select id="coCustomer" style="width:100%; margin-bottom:10px;">
        <option value="">Select customer…</option>
        ${(customers || []).map(c =>
          `<option value="${c.id}">${escapeHtml([c.first_name, c.last_name].filter(Boolean).join(" "))}</option>`
        ).join("")}
      </select>

      <label class="subtle">Dispatch to</label>
      <select id="coDispatchTo" style="width:100%; margin-bottom:10px;">
        <option value="customer">Customer</option>
        <option value="agent">Agent</option>
        <option value="other">Other</option>
      </select>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div>
          <label class="subtle">Ship to name</label>
          <input id="coShipName" placeholder="Full name" style="width:100%; margin-bottom:10px;" />
        </div>
        <div>
          <label class="subtle">Ship to phone</label>
          <input id="coShipPhone" placeholder="+971..." style="width:100%; margin-bottom:10px;" />
        </div>
      </div>

      <label class="subtle">Ship to email</label>
      <input id="coShipEmail" placeholder="email@example.com" style="width:100%; margin-bottom:10px;" />

      <label class="subtle">Ship to address</label>
      <textarea id="coShipAddress" rows="3" placeholder="Address" style="width:100%; margin-bottom:10px;"></textarea>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div>
          <label class="subtle">City</label>
          <input id="coShipCity" placeholder="City" style="width:100%; margin-bottom:10px;" />
        </div>
        <div>
          <label class="subtle">Country</label>
          <input id="coShipCountry" placeholder="Country" style="width:100%; margin-bottom:10px;" />
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
        <button id="coCancelBtn" type="button">Cancel</button>
        <button id="coCreateBtn" class="btn-success" type="button">Create</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const $product = overlay.querySelector("#coProduct");
    const $cust = overlay.querySelector("#coCustomer");
    const $dispatch = overlay.querySelector("#coDispatchTo");

    const $name = overlay.querySelector("#coShipName");
    const $phone = overlay.querySelector("#coShipPhone");
    const $email = overlay.querySelector("#coShipEmail");
    const $addr = overlay.querySelector("#coShipAddress");
    const $city = overlay.querySelector("#coShipCity");
    const $country = overlay.querySelector("#coShipCountry");

    function fillFromCustomer(c) {
      if (!c) return;
      $name.value = [c.first_name, c.last_name].filter(Boolean).join(" ");
      $phone.value = c.phone || "";
      $email.value = c.email || "";
      $addr.value = c.shipping_address || "";
      $city.value = c.shipping_city || "";
      $country.value = c.shipping_country || "";
    }

    function fillFromAgent(a) {
      if (!a) return;
      $name.value = a.name || "";
      $phone.value = a.phone || "";
      $email.value = a.email || "";
      $addr.value = a.shipping_address || "";
      $city.value = a.shipping_city || "";
      $country.value = a.shipping_country || "";
    }

    function applyDispatchDefaults() {
      const dispatch_to = String($dispatch.value || "customer");

      if (dispatch_to === "agent") {
        fillFromAgent(agent);
        return;
      }

      if (dispatch_to === "customer") {
        const id = String($cust.value || "");
        const c = (customers || []).find(x => x.id === id);
        fillFromCustomer(c);
        return;
      }
      // other: leave as-is
    }

    $cust?.addEventListener("change", () => {
      if (String($dispatch.value) === "customer") applyDispatchDefaults();
    });
    $dispatch?.addEventListener("change", () => applyDispatchDefaults());

    if ((customers || []).length === 1) $cust.value = customers[0].id;
    applyDispatchDefaults();

    // Product defaulting
    if ((products || []).length === 1) {
      $product.value = products[0].id;
    } else if (defaultProductId && (products || []).some(p => p.id === defaultProductId)) {
      $product.value = defaultProductId;
    }

    const cleanup = () => overlay.remove();

    overlay.querySelector("#coCancelBtn").onclick = () => {
      cleanup();
      onCancel?.();
    };

    overlay.querySelector("#coCreateBtn").onclick = () => {
      const product_id = String($product.value || "");
      const customer_id = String($cust.value || "");
      const dispatch_to = String($dispatch.value || "customer");

      const ship_to_name = String($name.value || "").trim();
      const ship_to_phone = String($phone.value || "").trim() || null;
      const ship_to_email = String($email.value || "").trim() || null;
      const ship_to_address = String($addr.value || "").trim();
      const ship_to_city = String($city.value || "").trim() || null;
      const ship_to_country = String($country.value || "").trim() || null;

      if (!product_id) return;
      if (!customer_id) return;
      if (!ship_to_name) return;
      if (!ship_to_address) return;

      cleanup();

      onSubmit?.({
        product_id,
        customer_id,
        dispatch_to,
        ship_to_name,
        ship_to_phone,
        ship_to_email,
        ship_to_address,
        ship_to_city,
        ship_to_country,
      });
    };
  }

  // ---------------------------------------------------------
  // List
  // ---------------------------------------------------------
  function renderOrderRow(o) {
    const code = escapeHtml(o.order_code || o.id);
    const status = escapeHtml(o.status || "—");
    const created = o.created_at ? escapeHtml(formatDateShort(o.created_at)) : "—";

    const cust = o.customer?.first_name || o.customer?.last_name
      ? `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim()
      : "—";

    return `
      <div class="customer-row" data-order-id="${escapeHtml(o.id)}" style="cursor:pointer;">
        <div style="font-weight:800;">${code}</div>
        <div class="subtle" style="margin-top:4px;">
          ${isAdminNow() ? `Payment: ${escapeHtml(o.payment_status || "—")} • ` : ""}
          Status: ${status} • Created: ${created} • Customer: ${escapeHtml(cust)}
        </div>
      </div>
    `;
  }

  async function loadOrders({ mode }) {
    setMsg("Loading orders…");

    const status = String(ordersStatusFilter?.value || "").trim();
    const q = String(ordersSearch?.value || "").trim();

    let query = supabaseClient
      .from("orders")
      .select(`
        id,
        order_code,
        status,
        payment_status,
        subtotal,
        tax,
        total,
        currency,
        created_at,
        customer_id,
        customer:customers (
          id,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);
    if (mode === "search" && q) query = query.ilike("order_code", `%${q}%`);

    const { data, error } = await query;
    if (error) { setMsg("Load failed: " + error.message); return; }

    const rows = data || [];
    if (ordersList) ordersList.innerHTML = rows.map(renderOrderRow).join("");
    setMsg(`Loaded ${rows.length} orders.`);
  }

  // ---------------------------------------------------------
  // Batch summary
  // ---------------------------------------------------------
  async function loadBatchSummaryFromBatches(orderId) {
    if (!ordersBatchSummary) return;
    ordersBatchSummary.innerHTML = `<div class="subtle">Loading…</div>`;

    const { data, error } = await supabaseClient
      .from("order_batches")
      .select("formula_key, batch_code, lab_batch_code")
      .eq("order_id", orderId)
      .order("formula_key", { ascending: true });

    if (error) {
      ordersBatchSummary.innerHTML = `<div class="subtle">Load batches failed: ${escapeHtml(error.message)}</div>`;
      return;
    }

    const batches = Array.isArray(data) ? data : [];
    if (!batches.length) {
      ordersBatchSummary.innerHTML = `<div class="subtle">No batches yet (generate pack to create).</div>`;
      return;
    }

    const header = `
      <div class="customer-row" style="font-weight:800;">
        <div>formula_key</div>
        <div>exact_batch_code</div>
        <div>fill_ml</div>
        <div>process_profile</div>
      </div>
    `;

    const metaForKey = (k) => {
      const key = String(k || "").toLowerCase();
      if (key === "eye") return { fill_ml: 15, process_profile: "gel_process_v1" };
      if (key === "day" || key === "night") return { fill_ml: 50, process_profile: "standard_emulsion_v1" };
      return { fill_ml: "—", process_profile: "—" };
    };

    const body = batches.map(b => {
      const fk = escapeHtml(b.formula_key || "—");
      const batch = escapeHtml(b.batch_code || "—");
      const meta = metaForKey(b.formula_key);
      const fill = escapeHtml(String(meta.fill_ml));
      const proc = escapeHtml(String(meta.process_profile));

      return `
        <div class="customer-row">
          <div>${fk}</div>
          <div>${batch}</div>
          <div>${fill}</div>
          <div>${proc}</div>
        </div>
      `;
    }).join("");

    ordersBatchSummary.innerHTML = header + body;
  }

  // ---------------------------------------------------------
  // Artifacts (admin-only)
  // ---------------------------------------------------------
  async function loadArtifacts(orderId) {
    if (!ordersArtifactsList) return;
    ordersArtifactsList.innerHTML = `<div class="subtle">Loading…</div>`;

    const { data, error } = await supabaseClient
      .from("order_artifacts")
      .select("id, artifact_type, format, version, created_at")
      .eq("order_id", orderId)
      .order("version", { ascending: false });

    if (error) { setMsg("Load artifacts failed: " + error.message); return; }

    const rows = data || [];
    if (!rows.length) {
      ordersArtifactsList.innerHTML = `<div class="subtle">No artifacts yet.</div>`;
      return;
    }

    const items = rows.map(a => {
      const created = a.created_at ? escapeHtml(formatDateShort(a.created_at)) : "—";
      return `
        <div class="customer-row" style="align-items:center;">
          <div style="font-weight:800;">${escapeHtml(a.artifact_type)}</div>
          <div class="subtle">v${escapeHtml(String(a.version))} • ${created}</div>
          <div style="text-align:right;">
            <button type="button"
              class="btn-primary"
              data-open-artifact="1"
              data-artifact-type="${escapeHtml(a.artifact_type)}"
              data-artifact-version="${escapeHtml(String(a.version))}">
              Open
            </button>
          </div>
        </div>
      `;
    }).join("");

    ordersArtifactsList.innerHTML = items;
  }

  // NOTE: Artifacts are stored in Supabase Storage and require a signed URL.
  // We try the Edge Function first (preferred), then fall back to RPC names that may exist
  // depending on which DB function you deployed.
  async function openArtifactSignedUrl(artifactType, version) {
    if (!selectedOrderId) return null;

    const payload = {
      order_id: selectedOrderId,
      artifact_type: artifactType,
      version: version,
    };

    // 1) Preferred: Edge Function (service-role boundary)
    try {
      const res = await supabaseClient.functions.invoke("get_artifact_signed_url", { body: payload });
      if (!res?.error) {
        const d = res?.data;
        const url = typeof d === "string" ? d : (d?.url || d?.signed_url || d?.signedUrl || null);
        if (url) return url;
      }
    } catch (_e) {
      // ignore and fall through
    }

    // 2) Fallback: RPC (older implementation)
    const rpcAttempts = [
      { fn: "get_order_artifact_signed_url", args: { p_order_id: selectedOrderId, p_artifact_type: artifactType, p_version: version } },
      { fn: "get_order_artifact_signed_url", args: { order_id: selectedOrderId, artifact_type: artifactType, version: version } },
      { fn: "get_artifact_signed_url", args: { p_order_id: selectedOrderId, p_artifact_type: artifactType, p_version: version } },
      { fn: "get_artifact_signed_url", args: { order_id: selectedOrderId, artifact_type: artifactType, version: version } },
    ];

    let lastErr = null;
    for (const a of rpcAttempts) {
      try {
        const { data, error } = await supabaseClient.rpc(a.fn, a.args);
        if (error) { lastErr = error; continue; }
        const url = typeof data === "string" ? data : (data?.url || data?.signed_url || data?.signedUrl || null);
        if (url) return url;
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) setMsg("Signed URL failed: " + (lastErr?.message || String(lastErr)));
    else setMsg("Signed URL returned no url.");
    return null;
  }

  // ---------------------------------------------------------
  // Payment actions (admin-only)
  // ---------------------------------------------------------
  async function setPaymentStatus(newStatus) {
    if (!selectedOrderId) return;
    if (!isAdminNow()) { setMsg("Not allowed."); return; }

    setMsg("Updating payment…");

    const { error } = await supabaseClient
      .from("orders")
      .update({ payment_status: newStatus })
      .eq("id", selectedOrderId);

    if (error) { setMsg("Update payment failed: " + error.message); return; }

    setMsg(newStatus === "paid" ? "Payment marked as PAID ✅" : "Order COMPED ✅");
    await openOrder(selectedOrderId);
  }

// ---------------------------------------------------------
// Generate pack (PAYMENT-GATED) + SPINNER
// ---------------------------------------------------------
async function generatePack() {
  if (!selectedOrderId) return;

  if (!canGeneratePackNow()) { setMsg("Not allowed."); return; }
  if (typeof window.exactGeneratePack !== "function") {
    setMsg("Missing window.exactGeneratePack(orderId).");
    return;
  }

  const btn = ordersGeneratePackBtn;
  const prevText = btn?.textContent || "Generate Pack";

  // helper: set loading UI
  const setLoading = (on) => {
    if (!btn) return;
    if (on) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="margin-right:8px;"></span>Generating…`;
    } else {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  };

  // HARD GATE: re-check payment status right now (server truth)
  setLoading(true);
  setMsg("Checking payment…");

  try {
    const { data: o, error: oErr } = await supabaseClient
      .from("orders")
      .select("payment_status")
      .eq("id", selectedOrderId)
      .maybeSingle();

    if (oErr) throw new Error("Payment check failed: " + oErr.message);

    const pay = String(o?.payment_status || "unpaid").toLowerCase();
    const isPaidLike = (pay === "paid" || pay === "comped");
    if (!isPaidLike) {
      setMsg("Payment required — please Pay Now first.");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Generate Pack (unpaid)";
      }
      return;
    }

    // Generate
    // If clinician panel is enabled for this order, persist + send the manual scores
    let dims = null;
    if (clinicianEnabledForOrder && clinicianScores) {
      dims = normalizeScores(clinicianScores);
      setMsg("Saving clinician scores…");
      const saved = await persistClinicianScoresToOrder(selectedOrderId, dims);
      if (!saved.ok) {
        console.warn("[ORDERS] Could not persist clinician scores:", saved.error);
        setMsg("Warning: could not persist clinician scores (continuing to generate).");
      }
    }

    // Generate (with optional override payload)
    setMsg("Generating pack…");
    const result = await window.exactGeneratePack(selectedOrderId, dims ? { dimensions: dims, dimensions_source: "clinician" } : {});

    // Refresh UI after success
    await openOrder(selectedOrderId);

    const v = result?.version ?? result?.pack_version ?? null;
    setMsg(v ? `Pack generated (v${v}).` : "Pack generated.");

    // Hide generate button once pack exists
    if (btn) btn.style.display = "none";
  } catch (e) {
    const msg = String(e?.message || e);
    setMsg(msg.includes("402")
      ? "Payment required (admin: Mark Paid or Comp)."
      : ("Generate pack failed: " + msg)
    );
    setLoading(false);
  }
}


  // ---------------------------------------------------------
  // Stripe payment (client)
  // ---------------------------------------------------------
  async function syncPaymentStatus(orderId) {
    // Calls server-side edge function to check PI status and update orders.payment_status
    try {
      const { data: sessData, error: sessErr } = await supabaseClient.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);
      const token = sessData?.session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await supabaseClient.functions.invoke("stripe_sync_payment_status", {
        body: { order_id: orderId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.error?.context) {
        const txt = res.error?.context?.response
          ? await res.error.context.response.text()
          : (res.error?.message || "");
        throw new Error(txt || res.error.message || "Sync failed");
      }
      if (res.error) throw new Error(res.error.message || "Sync failed");
      return res.data || null;
    } catch (e) {
      // Don’t hard-fail the UI; just show the message.
      if (ordersPayMsg) ordersPayMsg.textContent = "Payment completed — awaiting confirmation sync (webhook).";
      console.warn("[PAY] syncPaymentStatus failed:", e);
      return null;
    }
  }

  async function mountStripePaymentForOrder(orderId) {
    if (!ordersPayMsg || !ordersPayBtn || !stripePaymentEl || !ordersPayPanel) return;

    const pk = state?.stripePublishableKey;
    if (!pk) { ordersPayMsg.textContent = "Stripe publishable key missing."; return; }
    if (!window.Stripe) { ordersPayMsg.textContent = "Stripe.js not loaded."; return; }

    ordersPayMsg.textContent = "Creating payment…";
    stripePaymentEl.style.display = "none";
    stripePaymentEl.innerHTML = "";

    const { data: sessData, error: sessErr } = await supabaseClient.auth.getSession();
    if (sessErr) { ordersPayMsg.textContent = "Session error: " + sessErr.message; return; }
    const token = sessData?.session?.access_token;
    if (!token) { ordersPayMsg.textContent = "No active session token (please log in again)."; return; }

    const res = await supabaseClient.functions.invoke("stripe_create_payment_intent", {
      body: { order_id: orderId },
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.error?.context) {
      const txt = await res.error.context.text();
      console.log("stripe_create_payment_intent error body:", txt);
      ordersPayMsg.textContent = "Payment init failed: " + txt;
      return;
    }
    if (res.error) {
      ordersPayMsg.textContent = "Payment init failed: " + (res.error.message || "");
      return;
    }

    const clientSecret = res.data?.client_secret;
    if (!clientSecret) { ordersPayMsg.textContent = "Missing client_secret."; return; }

    // Mount Payment Element
    const stripe = window.Stripe(pk);
    const elements = stripe.elements({ clientSecret });

    stripePaymentEl.style.display = "block";
    const paymentElement = elements.create("payment");
    paymentElement.mount(stripePaymentEl);

    // Button text now becomes "Confirm payment"
    ordersPayBtn.textContent = "Confirm payment";
    ordersPayBtn.disabled = false;
    ordersPayMsg.textContent = "";

    // Confirm payment on button click
    ordersPayBtn.onclick = async () => {
      ordersPayBtn.disabled = true;
      ordersPayMsg.textContent = "Processing…";

      // Keep user inside the portal unless Stripe *requires* redirect (3DS, etc.)
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          // If redirect is required, return to the SAME page (you stay logged in)
          return_url: window.location.href
        }
      });

      if (error) {
        ordersPayMsg.textContent = error.message || "Payment failed";
        ordersPayBtn.disabled = false;
        return;
      }

      // If we got here with no redirect, we can immediately sync status & refresh.
      const piStatus = String(paymentIntent?.status || "").toLowerCase();

      if (piStatus === "succeeded") {
        ordersPayMsg.textContent = "Payment succeeded ✅ Updating order…";
        await syncPaymentStatus(orderId);
        await openOrder(orderId);
        return;
      }

      // For statuses that may complete async
      ordersPayMsg.textContent = "Payment submitted. Refreshing…";
      await syncPaymentStatus(orderId);
      await openOrder(orderId);
    };

    // Cancel hides Stripe element + resets button
    if (ordersPayCancelBtn) {
      ordersPayCancelBtn.onclick = () => {
        stripePaymentEl.style.display = "none";
        stripePaymentEl.innerHTML = "";
        ordersPayMsg.textContent = "";
        ordersPayBtn.textContent = "Pay now";
        ordersPayBtn.disabled = false;
      };
    }
  }

  // ---------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------
  async function openOrder(orderId) {
    selectedOrderId = orderId;
    setMsg("");

    show(ordersListPanel, false);
    show(ordersDetailPanel, true);

    const isAdmin = isAdminNow();
    const canGeneratePack = canGeneratePackNow();

    // Base visibility
    show(ordersBatchSummary, canGeneratePack);
    show(ordersArtifactsList, isAdmin);

    // Buttons
if (ordersMarkPaidBtn) show(ordersMarkPaidBtn, isAdmin);
if (ordersCompBtn) show(ordersCompBtn, isAdmin);

const refundable = isAdmin
  && String(o.status || "").toLowerCase() === "cancelled"
  && String(o.payment_status || "").toLowerCase() === "paid";

if (ordersRefundBtn) show(ordersRefundBtn, refundable);


    show(ordersGeneratePackBtn, canGeneratePack);

    // Hide section headers too (they're separate from the content divs)
    const batchHeaderEl = ordersBatchSummary?.previousElementSibling;
    if (batchHeaderEl) show(batchHeaderEl, canGeneratePack);

    const artifactsHeaderEl = ordersArtifactsList?.previousElementSibling;
    if (artifactsHeaderEl) show(artifactsHeaderEl, isAdmin);

    const { data: o, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) { setMsg("Load order failed: " + error.message); return; }
    if (!o) { setMsg("Order not found."); return; }

    lastPaymentStatus = o.payment_status || "unpaid";
    lastPayAmountMsg = "";

    // ===== CLINICIAN SCORES PANEL (product-based) =====
    clinicianEnabledForOrder = false;
    clinicianPaidLocked = false;
    if (ordersClinicianPanel) ordersClinicianPanel.style.display = "none";
    if (ordersScoresList) ordersScoresList.innerHTML = "";
    setScoresMsg("");

    // Paid/comped => permanently locked
    {
      const ps0 = String(o.payment_status || "").toLowerCase();
      clinicianPaidLocked = (ps0 === "paid" || ps0 === "comped");
    }

    // Determine which product this order is for (based on first order_item)
    const { product } = await loadOrderProductInfo(orderId);
    if (product && isProbablyClinicianProduct(product)) {
      clinicianEnabledForOrder = true;
      if (ordersClinicianPanel) ordersClinicianPanel.style.display = "";

      const saved = setClinicianStateFromOrderRow(o);
      try {
        renderClinicianScoresPanel(saved || defaultScores50());
      } catch (e) {
        console.error("[ClinicianScores] render failed:", e);
        setScoresMsg("Scores UI error: " + (e?.message || e));
      }

      if (!saved) {
        // First-time entry: editable, must save to proceed
        clinicianEditing = true;
        setClinicianInputsLocked(false);
      } else {
        // Saved already: lock by default
        clinicianEditing = false;
        setClinicianInputsLocked(true);
      }

      updateClinicianButtons();

      // Bind reset (once)
      if (ordersScoresResetBtn && ordersScoresResetBtn.dataset.bound !== "1") {
        ordersScoresResetBtn.addEventListener("click", () => {
          if (!clinicianEnabledForOrder || clinicianPaidLocked) return;
          if (!clinicianEditing) return;
          renderClinicianScoresPanel(defaultScores50());
          clinicianDirty = true;
          updateClinicianButtons();
          enforceClinicianPaymentGate();
          setScoresMsg("Reset to 50.");
        });
        ordersScoresResetBtn.dataset.bound = "1";
      }

      // Bind save/edit (once)
      if (ordersScoresSaveBtn && ordersScoresSaveBtn.dataset.bound !== "1") {
        ordersScoresSaveBtn.addEventListener("click", async () => {
          if (!selectedOrderId) return;
          if (!clinicianEnabledForOrder) return;
          if (clinicianPaidLocked) return;

          // If already saved and currently locked, enter edit mode
          if (clinicianSaved && !clinicianEditing) {
            clinicianEditing = true;
            clinicianDirty = false;
            setClinicianInputsLocked(false);
            updateClinicianButtons();
            enforceClinicianPaymentGate();
            setScoresMsg("Editing…");
            return;
          }

          // If editing but nothing changed and already saved: treat as "cancel edit" (re-lock)
          if (clinicianSaved && clinicianEditing && !clinicianDirty) {
            clinicianEditing = false;
            setClinicianInputsLocked(true);
            updateClinicianButtons();
            enforceClinicianPaymentGate();
            setScoresMsg("");
            return;
          }

          // Otherwise: save
          try {
            setScoresMsg("Saving…");
            const dims = normalizeScores(clinicianScores);
            const res = await persistClinicianScoresToOrder(selectedOrderId, dims);
            if (!res.ok) throw (res.error || new Error("Save failed"));

            clinicianSaved = true;
            clinicianEditing = false;
            clinicianDirty = false;
            setClinicianInputsLocked(true);
            updateClinicianButtons();
            enforceClinicianPaymentGate();
            setScoresMsg("Saved ✅");
          } catch (e) {
            setScoresMsg("Save failed: " + (e?.message || e));
          }
        });
        ordersScoresSaveBtn.dataset.bound = "1";
      }

      // If paid/comped: force permanent lock + hide controls
      if (clinicianPaidLocked) {
        clinicianSaved = clinicianSaved || !!saved;
        clinicianEditing = false;
        clinicianDirty = false;
        setClinicianInputsLocked(true);
        updateClinicianButtons();
      }
    }


    if (ordersDetailTitle) {
      ordersDetailTitle.textContent = `${o.order_code || "Order"} — ${o.status || ""}`;
    }

   if (ordersDetailMeta) {
  const parts = [];
  parts.push(`Order ID: ${o.id}`);
  parts.push(`Status: ${o.status || "—"}`);
  parts.push(`Payment: ${o.payment_status || "unpaid"}`);
  if (o.dispatch_to) parts.push(`Dispatch: ${o.dispatch_to}`);

  // Admin-only: show lab
  if (isAdminNow()) {
    if (o.lab_name_snapshot) parts.push(`Lab: ${o.lab_name_snapshot}`);
    else if (o.lab_id) parts.push(`Lab: ${o.lab_id}`);
  }

  ordersDetailMeta.textContent = parts.join(" | ");
}


    // ===== PAYMENT (Stripe) =====
    if (ordersPayPanel) ordersPayPanel.style.display = "";
    if (stripePaymentEl) { stripePaymentEl.style.display = "none"; stripePaymentEl.innerHTML = ""; }
    if (ordersPayMsg) ordersPayMsg.textContent = "";

    const ps = String(o.payment_status || "").toLowerCase();
    if (ps === "paid" || ps === "comped") {
      if (ordersPayPanel) ordersPayPanel.style.display = "none";
    } else {
      const ccy = String(o.currency || "AED");
      const amt = Number(o.total ?? o.subtotal ?? 0);
      lastPayAmountMsg = `Amount to charge: ${amt} ${ccy}`;
      if (ordersPayMsg) ordersPayMsg.textContent = lastPayAmountMsg;

      // Clinician-driven orders must have saved scores BEFORE payment
      if (clinicianEnabledForOrder) {
        const okToPay = clinicianSaved && !clinicianEditing && !clinicianDirty;
        if (!okToPay) {
          if (ordersPayMsg) ordersPayMsg.textContent = "Save clinician scores to proceed to payment.";
          if (ordersPayBtn) {
            ordersPayBtn.disabled = true;
            ordersPayBtn.textContent = "Pay now (save scores first)";
            ordersPayBtn.onclick = null;
          }
        }
      }

      if (ordersPayBtn) {
        // don't override clinician gating if already disabled above
        if (!ordersPayBtn.disabled) {
          ordersPayBtn.disabled = false;
          ordersPayBtn.textContent = "Pay now";
          ordersPayBtn.onclick = () => mountStripePaymentForOrder(o.id);
        }
      }
      // Apply clinician payment gate after payment UI is configured
      enforceClinicianPaymentGate();
    }

    // Reset generate button state on each open
    if (ordersGeneratePackBtn) {
      ordersGeneratePackBtn.style.display = canGeneratePack ? "" : "none";
      ordersGeneratePackBtn.disabled = false;
      ordersGeneratePackBtn.textContent = "Generate Pack";
    }

    // Disable generate unless paid/comped
    const pay = String(o.payment_status || "unpaid").toLowerCase();
    const isPaidLike = (pay === "paid" || pay === "comped");

    // Detect existing pack (any batch exists)
    const { data: existingBatches } = await supabaseClient
      .from("order_batches")
      .select("id")
      .eq("order_id", orderId)
      .limit(1);

    const hasPack = Array.isArray(existingBatches) && existingBatches.length > 0;

    if (ordersGeneratePackBtn) {
      if (hasPack) {
        ordersGeneratePackBtn.style.display = "none";
      } else if (canGeneratePack && !isPaidLike) {
        ordersGeneratePackBtn.disabled = true;
        ordersGeneratePackBtn.textContent = "Generate Pack (unpaid)";
      }
    }

    // Load batch summary (visible for admin+agent)
    if (canGeneratePack) await loadBatchSummaryFromBatches(orderId);
    else if (ordersBatchSummary) ordersBatchSummary.innerHTML = "";

    // Artifacts admin-only
    if (isAdmin) await loadArtifacts(orderId);
    else if (ordersArtifactsList) ordersArtifactsList.innerHTML = "";
  }

  // ---------------------------------------------------------
  // Bind
  // ---------------------------------------------------------
  function bindOnce() {
    if (ordersList && ordersList.dataset.bound !== "1") {
      ordersList.addEventListener("click", (e) => {
        const row = e.target.closest("[data-order-id]");
        if (!row) return;
        const id = row.getAttribute("data-order-id");
        if (!id) return;
        openOrder(id);
      });
      ordersList.dataset.bound = "1";
    }

    if (ordersShowAllBtn && ordersShowAllBtn.dataset.bound !== "1") {
      ordersShowAllBtn.addEventListener("click", () => loadOrders({ mode: "all" }));
      ordersShowAllBtn.dataset.bound = "1";
    }

    if (ordersSearchBtn && ordersSearchBtn.dataset.bound !== "1") {
      ordersSearchBtn.addEventListener("click", () => loadOrders({ mode: "search" }));
      ordersSearchBtn.dataset.bound = "1";
    }

    if (ordersBackBtn && ordersBackBtn.dataset.bound !== "1") {
      ordersBackBtn.addEventListener("click", () => {
        selectedOrderId = null;
        show(ordersDetailPanel, false);
        show(ordersListPanel, true);
        setMsg("");
      });
      ordersBackBtn.dataset.bound = "1";
    }

    if (ordersRefreshBtn && ordersRefreshBtn.dataset.bound !== "1") {
      ordersRefreshBtn.addEventListener("click", () => {
        if (selectedOrderId) openOrder(selectedOrderId);
      });
      ordersRefreshBtn.dataset.bound = "1";
    }

    if (ordersGeneratePackBtn && ordersGeneratePackBtn.dataset.bound !== "1") {
      ordersGeneratePackBtn.addEventListener("click", generatePack);
      ordersGeneratePackBtn.dataset.bound = "1";
    }

    if (ordersMarkPaidBtn && ordersMarkPaidBtn.dataset.bound !== "1") {
      ordersMarkPaidBtn.addEventListener("click", async () => setPaymentStatus("paid"));
      ordersMarkPaidBtn.dataset.bound = "1";
    }

    if (ordersCompBtn && ordersCompBtn.dataset.bound !== "1") {
      ordersCompBtn.addEventListener("click", async () => setPaymentStatus("comped"));
      ordersCompBtn.dataset.bound = "1";
    }

      if (ordersRefundBtn && ordersRefundBtn.dataset.bound !== "1") {
    ordersRefundBtn.addEventListener("click", async () => {
      if (!selectedOrderId) return;
      if (!isAdminNow()) { setMsg("Not allowed."); return; }

      const ok = confirm("Refund this order? This will call Stripe and mark the order as unpaid.");
      if (!ok) return;

      const note = prompt("Refund note (optional):", "Refund processed") || "";
      const amtStr = prompt("Refund amount (optional, leave blank for full):", "") || "";
      const refund_amount = (amtStr.trim() !== "") ? Number(amtStr) : null;

      if (refund_amount !== null && (!Number.isFinite(refund_amount) || refund_amount <= 0)) {
        setMsg("Invalid refund amount.");
        return;
      }

      setMsg("Processing refund…");

      const { data: sessData, error: sessErr } = await supabaseClient.auth.getSession();
      if (sessErr) { setMsg("Session error: " + sessErr.message); return; }
      const token = sessData?.session?.access_token;
      if (!token) { setMsg("No active session token (please log in again)."); return; }

      const body = { order_id: selectedOrderId };
      if (refund_amount !== null) body.refund_amount = refund_amount;
      if (note.trim() !== "") body.note = note.trim();

      const res = await supabaseClient.functions.invoke("refund-order", {
        body,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.error?.context?.response) {
        const txt = await res.error.context.response.text();
        setMsg("Refund failed: " + txt);
        return;
      }
      if (res.error) {
        setMsg("Refund failed: " + (res.error.message || ""));
        return;
      }

      setMsg("Refund succeeded ✅ Refreshing…");
      await openOrder(selectedOrderId);
    });

    ordersRefundBtn.dataset.bound = "1";
  }

    if (ordersArtifactsList && ordersArtifactsList.dataset.bound !== "1") {
      ordersArtifactsList.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-open-artifact='1']");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        const t = btn.getAttribute("data-artifact-type");
        const vStr = btn.getAttribute("data-artifact-version");
        const v = Number(vStr);
        if (!t || !Number.isFinite(v)) return;

        // UX: show something happening even if the status message is off-screen
        const prev = btn.textContent || "Open";
        btn.disabled = true;
        btn.textContent = "Opening…";

        try {
          const url = await openArtifactSignedUrl(t, v);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } finally {
          btn.disabled = false;
          btn.textContent = prev;
        }
      });
      ordersArtifactsList.dataset.bound = "1";
    }

    if (ordersCreateBtn && ordersCreateBtn.dataset.bound !== "1") {
      ordersCreateBtn.addEventListener("click", async () => {
        setMsg("");

        const profile = state?.currentProfile;
        const agent_id = profile?.agent_id;
        if (!agent_id) { setMsg("No agent_id in profile."); return; }

        const { data: customers, error: cErr } = await supabaseClient
          .from("customers")
          .select("id, first_name, last_name, email, phone, shipping_address, shipping_city, shipping_country")
          .order("created_at", { ascending: false });

        if (cErr) { setMsg("Load customers failed: " + cErr.message); return; }

        const { data: agentRow, error: aErr } = await supabaseClient
          .from("agents")
          .select("id, name, email, phone, shipping_address, shipping_city, shipping_country")
          .eq("id", agent_id)
          .maybeSingle();

        if (aErr) { setMsg("Load agent failed: " + aErr.message); return; }

        // Load products for dropdown
        const { data: products, error: prErr } = await supabaseClient
          .from("products")
          .select("id, product_code, name, workflow_key, product_kind, currency_code, unit_price_aed, is_active")
          .eq("is_active", true)
          .order("product_code", { ascending: true });

        if (prErr) { setMsg("Load products failed: " + prErr.message); return; }
        if (!products || products.length === 0) { setMsg("No active products found."); return; }

        renderCreateOrderModal({
          products,
          defaultProductId: "29c9e7e2-c728-4860-8f64-175fbf230a7c",
          customers,
          agent: agentRow,
          onCancel: () => {},
          onSubmit: async ({
            product_id,
            customer_id,
            dispatch_to,
            ship_to_name,
            ship_to_phone,
            ship_to_email,
            ship_to_address,
            ship_to_city,
            ship_to_country,
          }) => {
            setMsg("Creating order…");

            // Validate/Load chosen product FIRST (prevents orphan draft orders)
            const { data: p, error: pErr } = await supabaseClient
              .from("products")
              .select("product_code, name, product_kind, currency_code, unit_price_aed, workflow_key")
              .eq("id", product_id)
              .maybeSingle();

            if (pErr) { setMsg("Load product failed: " + pErr.message); return; }
            if (!p) { setMsg("Product not found for pricing."); return; }

            // Create order
            const { data: orderRow, error: oErr } = await supabaseClient
              .from("orders")
              .insert([{
                agent_id,
                customer_id,
                dispatch_to,
                ship_to_name,
                ship_to_phone,
                ship_to_email,
                ship_to_address,
                ship_to_city,
                ship_to_country,
              }])
              .select("id")
              .single();

            if (oErr) { setMsg("Create order failed: " + oErr.message); return; }

            const order_id = orderRow.id;

            // === ITEM + PRICING SNAPSHOT ===
            const qty = 1;

            const unit_price = Number(p.unit_price_aed || 0);
            const line_total = Number((unit_price * qty).toFixed(2));

            const { error: iErr } = await supabaseClient
              .from("order_items")
              .insert([{
                order_id,
                product_id,
                product_code_snapshot: p.product_code || "PRD0001",
                product_name_snapshot: p.name || "EXACT Personalized Skincare Set",
                product_kind_snapshot: p.product_kind || "dynamic",
                unit_price,
                quantity: qty,
                line_total,
              }]);

            if (iErr) { setMsg("Add item failed: " + iErr.message); return; }

            // Write totals onto orders immediately (so Stripe amount is never 0)
            const currency = String(p.currency_code || "AED");
            const subtotal = line_total;
            const tax = 0;
            const total = subtotal + tax;

            const { error: tErr } = await supabaseClient
              .from("orders")
              .update({ currency, subtotal, tax, total })
              .eq("id", order_id);

            if (tErr) { setMsg("Update totals failed: " + tErr.message); return; }

            await loadOrders({ mode: "all" });
            await openOrder(order_id);

           // IMPORTANT: Do NOT generate pack on create.
// Pack generation is gated by payment_status in openOrder().
// User must Pay Now -> payment_status becomes paid/comped -> Generate Pack becomes enabled.
setMsg("Draft order created ✅ (Pay now to enable Generate Pack)");

            }
        });
      });

      ordersCreateBtn.dataset.bound = "1";
    }
  }

  bindOnce();

  return {
    reset: resetScreen,
    enter: async () => {
      resetScreen();
      setMsg("Use Search or Show all.");
    },
  };
}
