console.log("EXACT Agents Portal loaded (v9)");

const SUPABASE_URL = "https://hwsycurvaayknghfgjxo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

// IMPORTANT for Edge stability:
// - persistSession: true (store in localStorage)
// - autoRefreshToken: false (prevents background fetch/abort on refresh)
// - storage: localStorage (explicit)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: false,
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

  function setLoggedIn(email) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    statusBox.style.display = "block";
    statusMsg.textContent = `Logged in as: ${email}`;
    setMsg("Logged in ✅ (persists on refresh)");
  }

  function setLoggedOut(message = "Not logged in") {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    statusBox.style.display = "none";
    statusMsg.textContent = "";
    setMsg(message);
  }

  // 1) Restore session from localStorage on page load (no network)
  (async () => {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error("getSession error:", error);
        setLoggedOut("Session restore error: " + error.message);
        return;
      }

      const email = data.session?.user?.email || null;
      console.log("restored session email =", email);

      if (email) setLoggedIn(email);
      else setLoggedOut("Not logged in");
    } catch (e) {
      console.error("Session restore crashed:", e);
      setLoggedOut("Session restore crashed: " + (e?.message || "Unknown error"));
    }
  })();

  // 2) Login
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
        console.error("Login failed:", error);
        setLoggedOut("Login failed: " + error.message);
        return;
      }

      const signedInEmail = data?.user?.email || email;
      console.log("signIn returned user =", signedInEmail);
      setLoggedIn(signedInEmail);
    } catch (e) {
      console.error("Login crashed:", e);
      setLoggedOut("Login crashed: " + (e?.message || "Unknown error"));
    }
  });

  // 3) Logout
  logoutBtn.addEventListener("click", async () => {
    setMsg("Logging out…");
    await supabaseClient.auth.signOut();
    setLoggedOut("Logged out");
  });

  // 4) Auth state changes (NO extra getSession calls)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth state change:", event);
    const email = session?.user?.email || null;

    if (event === "SIGNED_IN" && email) setLoggedIn(email);
    if (event === "SIGNED_OUT") setLoggedOut("Logged out");
  });
});
