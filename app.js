console.log("EXACT Agents Portal loaded (v7)");

const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";


// Force session persistence in Edge by explicitly using localStorage
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const authMsg = document.getElementById("authMsg");
  const statusBox = document.getElementById("statusBox");
  const statusMsg = document.getElementById("statusMsg");

  function setMsg(text) {
    authMsg.textContent = text || "";
  }

  async function refreshUI(tag = "refresh") {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      setMsg(`${tag}: Session error: ${error.message}`);
      console.error(tag, error);
      return;
    }

    const userEmail = data.session?.user?.email || null;

    loginBtn.style.display = userEmail ? "none" : "inline-block";
    logoutBtn.style.display = userEmail ? "inline-block" : "none";
    statusBox.style.display = userEmail ? "block" : "none";

    if (userEmail) {
      statusMsg.textContent = `Logged in as: ${userEmail}`;
      setMsg(`${tag}: Logged in ✅`);
    } else {
      statusMsg.textContent = "";
      setMsg(`${tag}: Not logged in`);
    }

    console.log(tag, "session user =", userEmail);
  }

  loginBtn.addEventListener("click", async () => {
    setMsg("Logging in…");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setMsg("Enter email + password.");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg("Login failed: " + error.message);
      console.error("Login failed:", error);
      return;
    }

    // Show immediately what Supabase returned
    console.log("signIn returned user =", data?.user?.email || null);
    await refreshUI("after login");
  });

  logoutBtn.addEventListener("click", async () => {
    setMsg("Logging out…");
    await supabaseClient.auth.signOut();
    await refreshUI("after logout");
  });

  supabaseClient.auth.onAuthStateChange((event) => {
    console.log("Auth state change:", event);
    refreshUI("auth change");
  });

  refreshUI("initial");
});
