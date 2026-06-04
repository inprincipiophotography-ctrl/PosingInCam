// Supabase auth for Pose Cards. Public keys only (safe in the browser; RLS protects data).
window.PoseAuth = (function () {
  const SUPABASE_URL = "https://zpowmnhdsybaicvlkkwx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_SEZuPrdI5pMDpdy5eiVT7w_z-SRzHTC";
  let client = null;
  let session = null;

  function sb() {
    if (!client && window.supabase) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return client;
  }

  async function init(onChange) {
    if (!sb()) return;
    try {
      const { data } = await sb().auth.getSession();
      session = data.session || null;
    } catch (_) {
      session = null;
    }
    sb().auth.onAuthStateChange((_event, s) => {
      session = s;
      if (onChange) onChange();
    });
    if (onChange) onChange();
  }

  function user() { return (session && session.user) || null; }
  function token() { return (session && session.access_token) || null; }

  async function signIn(email) {
    const redirect = window.location.origin + window.location.pathname;
    const { error } = await sb().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (sb()) await sb().auth.signOut();
  }

  return { init, user, token, signIn, signOut };
})();
