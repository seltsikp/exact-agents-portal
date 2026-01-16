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
if (!views || !views[viewKey]) console.warn("[NAV] Missing view element for:", viewKey);

    // permissions gate
    if (typeof canAccess === "function" && !canAccess(viewKey)) return;

    activeViewKey = viewKey;

    // show/hide views (generic)
Object.entries(views).forEach(([key, el]) => {
  show(el, key === viewKey);
});


    // menu highlight
    if (menuItems) {
      const btns = menuItems.querySelectorAll("button[data-view]");
      btns.forEach(b => b.classList.toggle("active", b.getAttribute("data-view") === viewKey));
    }

    // enter hooks (run only when we enter a view)
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

  // Always show Welcome
  addMenuBtn("Welcome", "welcome");

  // Admin gets everything
  if (role === "admin") {
    addMenuBtn("Agents", "agents");
    addMenuBtn("Account Managers", "accountManagers");
    addMenuBtn("Customers", "customers");
    addMenuBtn("Product Categories", "productTypes");
    addMenuBtn("Formulary", "formulary");
    addMenuBtn("Labs", "labs");
    addMenuBtn("Users", "userMgmt");
    setActiveView("welcome");
    return;
  }

  // Non-admin: show only what permissions allow
  const p = permissions || {};
  if (p.customers) addMenuBtn("Customers", "customers");
  if (p.accountManagers) addMenuBtn("Account Managers", "accountManagers");
  if (p.productTypes) addMenuBtn("Product Categories", "productTypes");
  if (p.formulary) addMenuBtn("Formulary", "formulary");
  if (p.labs) addMenuBtn("Labs", "labs");
  if (p.agents) addMenuBtn("Agents", "agents");

  setActiveView("welcome");
}


  return { setActiveView, renderMenuForRole };
}
