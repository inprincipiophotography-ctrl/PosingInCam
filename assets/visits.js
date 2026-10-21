/* Visitor analytics: Vercel Web Analytics (no cookies, nothing personal).
   Runs before /_vercel/insights/script.js, which picks up this queue once
   Analytics is enabled for the project; until then nothing is sent. */
(function () {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  // The magic link brings the sign-in token back in the address
  // (#access_token=…). Nothing after "#" is worth reporting, and secret
  // query parameters are blanked; utm_* and the rest stay for the stats.
  var SECRET = /([?&](?:code|access_token|refresh_token|provider_token|token|token_hash)=)[^&]*/gi;
  window.va("beforeSend", function (event) {
    var url = String(event.url || "").split("#")[0].replace(SECRET, "$1[redacted]");
    return Object.assign({}, event, { url: url });
  });

  /** One step of the funnel, e.g. trackEvent("Card made", { tier: "free" }).
   *  Values must be strings, numbers or booleans. Never throws. */
  window.trackEvent = function (name, data) {
    try { window.va("event", { name: name, data: data }); } catch (_) { /* analytics is optional */ }
  };
})();
