console.log("EXACT Agents Portal loaded (v8)");

const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

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

  const setMsg = (t) => (authMsg.textContent = t || "");

  let refreshInFlight = false;

  function setLoggedInUI(userEmail) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    statusBox.style.display = "block";
    statusMsg.textContent = `Logged in as: ${userEmail}`;
    setMsg("Logged in ✅");
  }

  function setLoggedOutUI() {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    statusBox.style.display = "none";
    statusMsg.textContent = "";
    setMsg("Not logged in");
  }

  async function refreshUI(tag = "refresh") {
    if (refreshInFlight) return;
    refreshInFlight = true;

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error(tag, "getSession error:", error);
        setMsg(`${tag}: Session error: ${error.message}`);
        return;
      }

      const email = data.session?.user?.email;
      console.log(tag, "session email =", email || null);

      if (email) setLoggedInUI(email);
      else setLoggedOutUI();
    } catch (e) {
      console.error(tag, "refreshUI crashed:", e);
      setMsg(`${tag}: ${e?.message || "Unknown error"}`);
    } finally {
      refreshInFlight = false;
    }
  }

  loginBtn.addEventListener("click", async () => {
    setMsg("Logging in…");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setMsg("Enter email + password.");
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        setMsg("Login failed: " + error.message);
        console.error("Login failed:", error);
        return;
      }

      // IMPORTANT: update UI immediately using the returned user
      const signedInEmail = data?.user?.email || email;
      console.log("signIn returned user =", signedInEmail);
      setLoggedInUI(signedInEmail);

      // Then do a gentle session refresh (gated so it can’t overlap)
      setTimeout(() => refreshUI("post-login refresh"), 250);
    } catch (e) {
      console.error("Login crashed:", e);
      setMsg("Login failed: " + (e?.message || "Unknown error"));
    }
  });

  logoutBtn.addEventListener("click", async () => {
    setMsg("Logging out…");
    await supabaseClient.auth.signOut();
    setLoggedOutUI();
  });

  // NOTE: Do NOT call refreshUI immediately on auth state change (prevents abort overlap)
  supabaseClient.auth.onAuthStateChange((event) => {
    console.log("Auth state change:", event);
    // Only refresh later, and gated:
    setTimeout(() => refreshUI("auth-change refresh"), 300);
  });

  refreshUI("initial");
});
