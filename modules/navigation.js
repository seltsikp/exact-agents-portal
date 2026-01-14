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

    // Always show Welcome first
    addMenuBtn("Welcome", "welcome");

    if (role === "admin") {
  addMenuBtn("Agent Management", "agents");
  addMenuBtn("Customer Management", "customers");
  addMenuBtn("Product Types", "productTypes");
  addMenuBtn("EXACT Formulary", "formulary");
  addMenuBtn("Lab Management", "labs");
}


    // Default view after login
    setActiveView("welcome");
  }

  return { setActiveView, renderMenuForRole };
}
