console.log("EXACT Agents Portal loaded (v3)");

// Supabase config
const SUPABASE_URL = "https://hwsxcurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUid4pV3X35G_WyTPGuhMg_WQbOMJyJ";

// Use a unique variable name (NOT "supabase")
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase session check failed:", error.message);
    return;
  }
  console.log("Supabase connected. Session:", data.session ? "logged in" : "not logged in");
})();
