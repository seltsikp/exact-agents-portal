console.log("EXACT Agents Portal loaded (v5)");

const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.addEventListener("DOMContentLoaded", () => {
  // Grab elements after DOM is definitely ready
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const authMsg = document.getElementById("authMsg");
  const statusBox = document.getElementById("statusBox");
  const statusMsg = document.getElementById("statusMsg");

  // If any are missing, show it immediately
  const missing = [];
  if (!emailInput) missing.push("email");
  if (!passwordInput) missing.push("password");
  if (!loginBtn) missing.push("loginBtn");
  if (!logoutBtn) missing.push("logoutBtn");
  if (!authMsg) missing.push("authMsg");
  if (!statusBox) missing.push("statusBox");
  if (!statusMsg) missing.push("statusMsg");

  if (missing.length) {
    alert("Missing elements: " + missing.join(", ") + ". Check index.html IDs.");
    console.error("Missing elements:", missing);
    return;
  }

  async function refreshUI() {
    authMsg.textContent = "";
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      authMsg.textContent = "Session error: " + error.message;
      console.error(error);
      return;
    }

    const loggedIn = !!data.session?.user;
    loginBtn.style.display = loggedIn ? "none" : "inline-block";
    logoutBtn.style.display = loggedIn ? "inline-block" : "none";
    statusBox.style.display = loggedIn ? "block" : "none";

    if (loggedIn) {
      statusMsg.textContent = `Logged in as: ${data.session.user.email}`;
    } else {
      statusMsg.textContent = "";
    }
  }

  loginBtn.addEventListener("click", async () => {
    // Visible feedback so it never feels like "nothing"
    authMsg.textContent = "Logging in…";
    console.log("Login button clicked");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      authMsg.textContent = "Enter email + password.";
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = "Login failed: " + error.message;
      console.error("Login error:", error);
      return;
    }

    await refreshUI();
  });

  logoutBtn.addEventListener("click", async () => {
    authMsg.textContent = "Logging out…";
    await supabaseClient.auth.signOut();
    await refreshUI();
  });

  supabaseClient.auth.onAuthStateChange(() => refreshUI());
  refreshUI();
});
