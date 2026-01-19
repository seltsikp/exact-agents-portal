// modules/navigation.js
export function initNavigation({
  menuItems,
  views,
  show,
  canAccess,
  onEnter
}) {
  let activeViewKey = null;

  function setActiveView(viewKey) {
    console.log("[NAV] setActiveView:", viewKey);

    if (typeof canAccess === "function" && !canAccess(viewKey)) return;

    activeViewKey = viewKey;

    // show/hide views (views ARE DOM elements)
    Object.entries(views).forEach(([key, el]) => {
      show(el, key === viewKey);
    });

    // menu highlight
    if (menuItems) {
      const btns = menuItems.querySelectorAll("button[data-view]");
      btns.forEach(b =>
        b.classList.toggle("active", b.getAttribute("data-view") === viewKey)
      );
    }

    // enter hooks
    if (onEnter && typeof onEnter[viewKey] === "function") {
      onEnter[viewKey]();
    }
  }

  function renderMenuForRole(role, permissions = {}) {
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

    addMenuBtn("Welcome", "welcome");

    if (role === "admin") {
      addMenuBtn("Orders", "orders");
      addMenuBtn("Agents", "agents");
      addMenuBtn("Account Managers", "accountManagers");
      addMenuBtn("Customers", "customers");
      addMenuBtn("Products", "productsAdmin");
      addMenuBtn("Product Groups", "productTypes");
      addMenuBtn("Formulary", "formulary");
      addMenuBtn("Labs", "labs");
      addMenuBtn("Users", "userMgmt");
      setActiveView("welcome");
      return;
    }

    const p = permissions || {};
    if (p.customers) addMenuBtn("Customers", "customers");
    if (p.productTypes) addMenuBtn("Product Groups", "productTypes");
    if (p.formulary) addMenuBtn("Formulary", "formulary");
    if (p.labs) addMenuBtn("Labs", "labs");
    if (p.agents) addMenuBtn("Agents", "agents");
    if (p.orders) addMenuBtn("Orders", "orders");

    setActiveView("welcome");
  }

  return { setActiveView, renderMenuForRole };
}
