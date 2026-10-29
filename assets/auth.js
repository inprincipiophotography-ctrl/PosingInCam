// Sign-in for Shoot Cards. The session lives in HttpOnly cookies set by
// /api/auth (see webauth/session.py): this script never sees a token, so a
// script injected into the page can't steal one. It only asks /api/me who is
// signed in, and sends same-origin requests that carry the cookies by themselves.
window.PoseAuth = (function () {
  // Where supabase-js kept the session before October 2026. Moved to cookies
  // once, then deleted, so nobody gets signed out by the switch.
  const LEGACY_KEY = "sb-zpowmnhdsybaicvlkkwx-auth-token";
  let me = null;          // /api/me answer while signed in
  let notify = null;

  async function load() {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const j = await r.json();
      me = j && j.signed_in ? j : null;
    } catch (_) {
      me = null;
    }
  }

  async function migrateLegacy() {
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch (_) {}
    if (!raw) return;
    try { localStorage.removeItem(LEGACY_KEY); } catch (_) {}
    let rt = null;
    try { rt = JSON.parse(raw).refresh_token; } catch (_) {}
    if (!rt) return;
    try {
      await fetch("/api/auth?action=migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
    } catch (_) {}
  }

  async function init(onChange) {
    notify = onChange;
    await migrateLegacy();
    await load();
    // Signed in from the email link in another tab: pick it up on return.
    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      const was = !!me;
      await load();
      if (was !== !!me && notify) notify();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    if (notify) notify();
  }

  function user() { return me ? { email: me.email } : null; }
  function signedIn() { return !!me; }

  // Resolves when the link is on its way. Rejects with err.captcha (site key)
  // when a CAPTCHA is needed first, err.retryAfter (seconds) when rate-limited.
  async function signIn(email, captcha) {
    let r, j = {};
    try {
      r = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(captcha ? { email, captcha } : { email }),
      });
    } catch (_) {
      throw new Error("No connection.");
    }
    try { j = await r.json(); } catch (_) {}
    if (r.ok && j.sent) return;
    const err = new Error(j.error || "The link didn't send.");
    if (j.captcha_required) err.captcha = j.captcha_site_key;
    if (j.retry_after) err.retryAfter = j.retry_after;
    throw err;
  }

  async function signOut() {
    try { await fetch("/api/auth?action=logout", { method: "POST" }); } catch (_) {}
    me = null;
    if (notify) notify();
  }

  return { init, user, signedIn, signIn, signOut };
})();
