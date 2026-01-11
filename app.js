console.log("EXACT Agents Portal loaded");

// Paste your Supabase URL + publishable key here
const SUPABASE_URL = "https://hwsxcurvaayknghfgjxo.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

// Use a unique variable name to avoid collisions
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase session check failed:", error.message);
    return;
  }
  console.log("Supabase connected. Session:", data.session ? "logged in" : "not logged in");
})();
