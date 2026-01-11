console.log("EXACT Agents Portal loaded");

// 1) Paste your Supabase URL + anon key here
const SUPABASE_URL = "PASTE_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY";

// 2) Create client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3) Quick smoke test: show current auth status
(async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Supabase session check failed:", error.message);
    return;
  }
  console.log("Supabase connected. Session:", data.session ? "logged in" : "not logged in");
})();
