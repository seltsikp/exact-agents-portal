// modules/idleLogout.js
// EXACT Portal — inactivity logout (client enforced) + 60s warning + JWT-expiry sync

export function initIdleLogout({
  supabaseClient,
  idleMs = 15 * 60 * 1000,      // inactivity window
  warnMs = 60 * 1000,           // show banner this long before logout
  jwtBufferMs = 30 * 1000,      // logout this long BEFORE JWT expiry (safety)
  onWarn,                       // ({ secondsLeft, reason, stayLoggedIn }) => void
  onWarnClear,                  // () => void
  onLogout                       // (reason) => void ; reason = "idle" | "jwt-expiry"
}) {
  if (!supabaseClient?.auth) return () => {};

  let lastActivity = Date.now();
  let timer = null;
  let warned = false;

  const mark = () => {
    lastActivity = Date.now();
    if (warned) {
      warned = false;
      if (typeof onWarnClear === "function") onWarnClear();
    }
  };

  const events = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "touchmove",
    "pointerdown",
    "pointermove"
  ];

  function cleanup() {
    events.forEach(e => window.removeEventListener(e, mark));
    window.removeEventListener("focus", mark);
    document.removeEventListener("visibilitychange", onVis);
    if (timer) clearInterval(timer);
    timer = null;
  }

  function onVis() {
    if (!document.hidden) mark();
  }

  async function forceLogout(reason) {
    cleanup();
    try { await supabaseClient.auth.signOut(); } catch (_e) {}
    if (typeof onLogout === "function") onLogout(reason);
  }

  function stayLoggedIn() {
    mark();
  }

  async function tick() {
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;

    // If already signed out, stop timers/listeners
    if (!session) return cleanup();

    const now = Date.now();

    // ---- 1) Idle deadline
    const idleDeadlineMs = lastActivity + idleMs;

    // ---- 2) JWT expiry deadline (if present)
    // Supabase session.expires_at is usually unix seconds.
    // We log out a little BEFORE expiry to avoid "random 401" edge cases.
    let jwtDeadlineMs = Infinity;
    if (typeof session.expires_at === "number" && Number.isFinite(session.expires_at)) {
      jwtDeadlineMs = (session.expires_at * 1000) - jwtBufferMs;
    } else if (typeof session.expires_in === "number" && Number.isFinite(session.expires_in)) {
      // fallback: expires_in seconds from *now* (less accurate but ok)
      jwtDeadlineMs = now + (session.expires_in * 1000) - jwtBufferMs;
    }

    const deadline = Math.min(idleDeadlineMs, jwtDeadlineMs);
    const msLeft = deadline - now;

    // WARNING window
    if (msLeft > 0 && msLeft <= warnMs) {
      const secondsLeft = Math.ceil(msLeft / 1000);
      const reason = (deadline === jwtDeadlineMs) ? "jwt-expiry" : "idle";

      warned = true;
      if (typeof onWarn === "function") {
        onWarn({ secondsLeft, reason, stayLoggedIn });
      }
    }

    // LOGOUT
    if (msLeft <= 0) {
      const reason = (deadline === jwtDeadlineMs) ? "jwt-expiry" : "idle";
      await forceLogout(reason);
    }
  }

  // init
  events.forEach(e => window.addEventListener(e, mark, { passive: true }));
  window.addEventListener("focus", mark);
  document.addEventListener("visibilitychange", onVis);

  timer = setInterval(tick, 1000);

  return cleanup;
}
