console.log("EXACT Agents Portal loaded (v4)");

// Supabase config
const SUPABASE_URL = "https://hwsxcurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

// Use a unique variable name (avoid conflicts)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");

const statusBox = document.getElementById("statusBox");
const statusMsg = document.getElementById("statusMsg");

async function refreshUI() {
  authMsg.textContent = "";

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    authMsg.textContent = "Session error: " + error.message;
    console.error("Supabase session check failed:", error.message);
    return;
  }

  const loggedIn = !!data.session?.user;

  loginBtn.style.display = loggedIn ? "none" : "inline-block";
  logoutBtn.style.display = loggedIn ? "inline-block" : "none";
  statusBox.style.display = loggedIn ? "block" : "none";

  if (loggedIn) {
    statusMsg.textContent = `Logged in as: ${data.session.user.email}`;
    console.log("Supabase connected. Session: logged in");
  } else {
    statusMsg.textContent = "";
    console.log("Supabase connected. Session: not logged in");
  }
}

loginBtn.addEventListener("click", async () => {
  authMsg.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMsg.textContent = "Enter email + password.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    authMsg.textContent = "Login failed: " + error.message;
    return;
  }

  await refreshUI();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshUI();
});

// React to auth changes (login/logout in other tab etc.)
supabaseClient.auth.onAuthStateChange(async () => {
  await refreshUI();
});

// Initial load
refreshUI();
