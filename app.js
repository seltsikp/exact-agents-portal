console.log("EXACT Agents Portal loaded");

// Supabase config
const SUPABASE_URL = "https://hwsxcurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

// IMPORTANT: use a unique variable name so it can't clash
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase error:", error.message);
  } else {
    console.log(
      "Supabase connected. Session:",
      data.session ? "logged in" : "not logged in"
    );
  }
})();
